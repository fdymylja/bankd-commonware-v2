// Command proverhttp puts an HTTP front on the gnark prover daemon so the
// browser wallet can build private transfers on a localnet.
//
// The wallet's wasm cannot hold a 245MB proving key, so it POSTs
// {family, witness} to PENUMBRA_PROVER_URL and expects {result}. The daemon
// that owns the keys speaks a length-prefixed protocol over stdin/stdout
// instead, and nothing in this repo bridged the two, so a private send failed
// at build time with ERR_CONNECTION_REFUSED.
//
// Local development only: no auth, no TLS, and one daemon per family kept warm
// for the life of the process.
package main

import (
	"bufio"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

const (
	requestMagic  = "PGRQ"
	responseMagic = "PGRS"
	opProve       = 1
	// Witness payloads are a few KB. The daemon caps requests at 4MiB, so
	// rejecting earlier keeps a bad request from killing a warm daemon.
	maxWitness = 4 * 1024 * 1024
)

// daemon is one warm proverdaemon subprocess. gnark's Prove is not reentrant
// over a single stdin pipe, so calls are serialized.
type daemon struct {
	mu     sync.Mutex
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout *bufio.Reader
}

type startDaemonInput struct {
	binary   string
	family   string
	artifact string
}

func startDaemon(in startDaemonInput) (*daemon, error) {
	cmd := exec.Command(in.binary, "--circuit", in.family, "--artifact-dir", in.artifact)
	cmd.Stderr = os.Stderr
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("stdin pipe for %s: %w", in.family, err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("stdout pipe for %s: %w", in.family, err)
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start prover daemon for %s: %w", in.family, err)
	}

	// The daemon compiles the circuit and reads the proving key before it
	// writes the ready line, so this blocks for a while on a cold start.
	reader := bufio.NewReaderSize(stdout, 1<<20)
	line, err := reader.ReadBytes('\n')
	if err != nil {
		return nil, fmt.Errorf("read ready handshake for %s: %w", in.family, err)
	}
	var ready struct {
		Magic   string `json:"magic"`
		Status  string `json:"status"`
		Circuit string `json:"circuit"`
	}
	if err := json.Unmarshal(line, &ready); err != nil {
		return nil, fmt.Errorf("decode ready handshake for %s: %w", in.family, err)
	}
	if ready.Status != "ready" {
		return nil, fmt.Errorf("prover daemon for %s reported status %q", in.family, ready.Status)
	}
	slog.Info("prover ready", "family", in.family, "circuit", ready.Circuit)
	return &daemon{cmd: cmd, stdin: stdin, stdout: reader}, nil
}

func (d *daemon) prove(witness []byte) ([]byte, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	header := make([]byte, 12)
	copy(header[:4], requestMagic)
	binary.LittleEndian.PutUint32(header[4:8], uint32(12+len(witness)))
	binary.LittleEndian.PutUint32(header[8:12], opProve)
	if _, err := d.stdin.Write(append(header, witness...)); err != nil {
		return nil, fmt.Errorf("write prove request: %w", err)
	}

	var respHeader [12]byte
	if _, err := io.ReadFull(d.stdout, respHeader[:]); err != nil {
		return nil, fmt.Errorf("read prove response header: %w", err)
	}
	if string(respHeader[:4]) != responseMagic {
		return nil, fmt.Errorf("invalid daemon response magic %q", respHeader[:4])
	}
	total := binary.LittleEndian.Uint32(respHeader[4:8])
	if total < 12 {
		return nil, fmt.Errorf("invalid daemon response length %d", total)
	}
	status := binary.LittleEndian.Uint32(respHeader[8:12])
	payload := make([]byte, total-12)
	if _, err := io.ReadFull(d.stdout, payload); err != nil {
		return nil, fmt.Errorf("read prove response payload: %w", err)
	}
	if status != 0 {
		return nil, fmt.Errorf("prover daemon: %s", payload)
	}
	return payload, nil
}

type proveRequest struct {
	Family  string `json:"family"`
	Witness string `json:"witness"`
}

type proveResponse struct {
	Result string `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

// pool starts a daemon per family on first use and keeps it warm.
type pool struct {
	mu          sync.Mutex
	binary      string
	artifactDir string
	daemons     map[string]*daemon
}

func (p *pool) get(family string) (*daemon, error) {
	if family != "transfer" && family != "shielded_withdrawal" {
		return nil, fmt.Errorf("unsupported browser proof family %q", family)
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if d, ok := p.daemons[family]; ok {
		return d, nil
	}
	// Families are named after their artifact directory.
	artifact := filepath.Join(p.artifactDir, family)
	if _, err := os.Stat(artifact); err != nil {
		return nil, fmt.Errorf("no artifacts for family %q at %s", family, artifact)
	}
	d, err := startDaemon(startDaemonInput{binary: p.binary, family: family, artifact: artifact})
	if err != nil {
		return nil, err
	}
	p.daemons[family] = d
	return d, nil
}

func writeJSON(w http.ResponseWriter, code int, body proveResponse) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}

func (p *pool) handleProve(w http.ResponseWriter, r *http.Request) {
	// The wallet runs on a different port, so the browser preflights.
	w.Header().Set("access-control-allow-origin", "*")
	w.Header().Set("access-control-allow-headers", "content-type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, proveResponse{Error: "POST only"})
		return
	}

	var req proveRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, maxWitness)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, proveResponse{Error: fmt.Sprintf("decode request: %v", err)})
		return
	}
	witness, err := base64.StdEncoding.DecodeString(req.Witness)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, proveResponse{Error: fmt.Sprintf("decode witness: %v", err)})
		return
	}

	d, err := p.get(req.Family)
	if err != nil {
		slog.Error("prover unavailable", "family", req.Family, "err", err)
		writeJSON(w, http.StatusServiceUnavailable, proveResponse{Error: err.Error()})
		return
	}

	start := time.Now()
	result, err := d.prove(witness)
	if err != nil {
		slog.Error("prove failed", "family", req.Family, "err", err)
		writeJSON(w, http.StatusInternalServerError, proveResponse{Error: err.Error()})
		return
	}
	slog.Info("proved", "family", req.Family, "ms", time.Since(start).Milliseconds())
	writeJSON(w, http.StatusOK, proveResponse{Result: base64.StdEncoding.EncodeToString(result)})
}

func main() {
	addr := flag.String("addr", "127.0.0.1:8090", "listen address")
	binary := flag.String("daemon", "", "path to the proverdaemon binary")
	artifactDir := flag.String("artifact-dir", "", "directory holding one subdirectory of gnark artifacts per family")
	warm := flag.String("warm", "", "family to start before listening, so the first transfer is not the slow one")
	flag.Parse()

	if *binary == "" || *artifactDir == "" {
		fmt.Fprintln(os.Stderr, "--daemon and --artifact-dir are required")
		os.Exit(2)
	}

	p := &pool{binary: *binary, artifactDir: *artifactDir, daemons: map[string]*daemon{}}
	if *warm != "" {
		if _, err := p.get(*warm); err != nil {
			fmt.Fprintf(os.Stderr, "warm %s: %v\n", *warm, err)
			os.Exit(1)
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/prove", p.handleProve)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok\n"))
	})

	slog.Info("listening", "addr", *addr)
	server := &http.Server{
		Addr:    *addr,
		Handler: mux,
		// A cold family compiles its circuit inside the request.
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      10 * time.Minute,
	}
	if err := server.ListenAndServe(); err != nil {
		fmt.Fprintf(os.Stderr, "serve: %v\n", err)
		os.Exit(1)
	}
}

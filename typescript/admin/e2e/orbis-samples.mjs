export const verificationSamples = [
  { sender: 'Charlie', receiver: 'Alice', amount: 1000 },
  { sender: 'Bob', receiver: 'Charlie', amount: 1000 },
  { sender: 'Diana', receiver: 'Alice', amount: 1000 },
]

const participants = [
  { sender: 'Charlie', receiver: 'Alice' },
  { sender: 'Alice', receiver: 'Charlie' },
  { sender: 'Alice', receiver: 'Bob' },
  { sender: 'Charlie', receiver: 'Bob' },
  { sender: 'Alice', receiver: 'Bob' },
]

export const manualSamples = Array.from({ length: 15 }, (_, index) =>
  index === 14
    ? { sender: 'Charlie', receiver: 'Alice', amount: 50000 }
    : { ...participants[index % participants.length], amount: 250 + (index + 1) * 25 }
)

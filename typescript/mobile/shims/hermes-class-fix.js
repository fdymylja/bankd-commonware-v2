/**
 * Fix for Hermes not supporting `class extends Error` properly.
 *
 * Hermes reports that Reflect.construct is available, but it doesn't
 * work correctly for extending builtins like Error, Map, Set, etc.
 * This causes @babel/runtime/helpers/construct.js to fail.
 *
 * The fix: patch Reflect.construct to handle Error subclassing correctly.
 */

if (typeof Reflect !== 'undefined' && typeof Reflect.construct === 'function') {
  const originalConstruct = Reflect.construct

  Reflect.construct = function (Target, args, NewTarget) {
    try {
      return originalConstruct.call(this, Target, args, NewTarget)
    } catch (e) {
      // Fallback: manually construct for Error subclasses
      if (Target === Error || (Target && Target.prototype instanceof Error)) {
        const instance = new Target(...args)
        if (NewTarget && NewTarget !== Target) {
          Object.setPrototypeOf(instance, NewTarget.prototype)
        }
        return instance
      }
      // For non-Error classes, try without NewTarget
      if (NewTarget && NewTarget !== Target) {
        try {
          return originalConstruct.call(this, Target, args)
        } catch {
          // Last resort
          return new Target(...args)
        }
      }
      throw e
    }
  }
}

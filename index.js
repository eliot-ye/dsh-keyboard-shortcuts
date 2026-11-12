/**
 * Host half of the keyboard-shortcuts bundle.
 *
 * The capability is entirely a Web UI concern (a capture-phase keydown listener
 * in ./client.js), so the Host half has nothing to register. It exists only to
 * satisfy the bundle's `.` export.
 */
export function apply() {}
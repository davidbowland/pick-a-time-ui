// Mocks getBoundingClientRect/clientWidth *before* mount (useLayoutEffect runs synchronously
// during mount, so measurements must already be in place — patching them afterward is too late).
// Restoring clientWidth requires Reflect.deleteProperty rather than restoring a captured
// descriptor: in jsdom, `clientWidth` is defined on `Element.prototype`, not
// `HTMLElement.prototype`, so `Object.getOwnPropertyDescriptor(HTMLElement.prototype,
// 'clientWidth')` is always undefined and a naive restore would silently no-op, leaking the
// mocked value into later tests.
export function mockColumnLayout(
  columnWidth: number,
  gap: number,
  labelWidth: number,
  visibleColumns: number,
): () => void {
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  let columnIndex = 0
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement): DOMRect {
    if (this.hasAttribute('data-scroll-label')) {
      return {
        left: 0,
        right: labelWidth,
        width: labelWidth,
        bottom: 0,
        height: 0,
        top: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    }
    if (this.hasAttribute('data-scroll-column')) {
      const left = labelWidth + columnIndex * (columnWidth + gap)
      columnIndex += 1
      return {
        left,
        right: left + columnWidth,
        width: columnWidth,
        bottom: 0,
        height: 0,
        top: 0,
        x: left,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    }
    return originalRect.call(this)
  }
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: labelWidth + visibleColumns * (columnWidth + gap),
  })
  return () => {
    HTMLElement.prototype.getBoundingClientRect = originalRect
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
    }
  }
}

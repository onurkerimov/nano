import './types.js'

export const isSSR = () => typeof _nano !== 'undefined' && _nano.isSSR === true

export interface FC<P = {}> {
  (props: P): Element | void
  // (props: P, context?: any): any
}

const doc = document
const isArray = Array.isArray

export const appendChildren = (element: HTMLElement | SVGElement, children: HTMLElement[]) => {
  // if the child is an html element
  if (!isArray(children)) {
    appendChildren(element, [children])
    return
  }

  // htmlCollection to array
  if (typeof children === 'object') children = Array.prototype.slice.call(children)

  children.forEach(child => {
    // if child is an array of children, append them instead
    if (isArray(child)) appendChildren(element, child)
    else {
      // render the component
      const c = _render(child) as HTMLElement

      if (c !== undefined) {
        // if c is an array of children, append them instead
        if (isArray(c)) appendChildren(element, c)
        // apply the component to parent element
        else {
          element.appendChild(c.nodeType == null ? doc.createTextNode(c.toString()) : c)
        }
      }
    }
  })
}

/**
 * A simple component for rendering SVGs
 */
const SVG = (props: any) => {
  const child = props.children[0] as SVGElement
  const attrs = child.attributes
  const svg = hNS('svg') as SVGElement

  for (let i = attrs.length - 1; i >= 0; i--) {
    svg.setAttribute(attrs[i].name, attrs[i].value)
  }
  svg.innerHTML = child.innerHTML

  return svg as any
}

/** Returns the populated parent if available else  one child or an array of children */
export const render = (component: any, parent: HTMLElement | null = null) => {
  let el = _render(component)

  if (isArray(el)) {
    el = el.map(e => _render(e))
    if (el.length === 1) el = el[0]
  }

  if (parent) {
    // if parent and child are the same, we replace the parent instead of appending to it
    if (el && parent.id && parent.id === el.id && parent.parentElement) {
      parent.parentElement.replaceChild(el, parent)
    } else {
      // append element(s) to the parent
      if (isArray(el))
        el.forEach((e: any) => {
          appendChildren(parent, _render(e))
          //parent.appendChild(_render(e))
        })
      else appendChildren(parent, _render(el))
    }
    return parent
  }
  return el
}

export const _render = (comp: any): any => {
  // null, false, undefined
  if (comp === null || comp === false || comp === undefined) return []

  // string, number
  if (typeof comp === 'string' || typeof comp === 'number') return comp.toString()

  // SVGElement
  if (comp.tagName && comp.tagName.toLowerCase() === 'svg') return SVG({ children: [comp] })

  // HTMLElement
  if (comp.tagName) return comp

  // TEXTNode (Node.TEXT_NODE === 3)
  if (comp && comp.nodeType === 3) return comp

  // Functional Component
  if (comp.c && typeof comp.c === 'function') return renderFunctionalComponent(comp)

  // Array (render each child and return the array) (is probably a fragment)
  if (isArray(comp)) return (comp.map(c => _render(c)) as any).flat()

  // function
  if (typeof comp === 'function') return _render(comp())

  // if component is a HTMLElement (rare case)
  if (comp.c && comp.c.tagName && typeof comp.c.tagName === 'string')
    return _render(comp.c)

  // (rare case)
  if (isArray(comp.c)) return _render(comp.c)

  // (rare case)
  if (comp.c) return _render(comp.c)

  console.warn('Something unexpected happened with:', comp)
}

const renderFunctionalComponent = (fncComp: any): any => {
  const { c, props } = fncComp
  return _render(c(props))
}

const hNS = (tag: string) => doc.createElementNS('http://www.w3.org/2000/svg', tag) as SVGElement

// https://stackoverflow.com/a/42405694/12656855
export const h = (tagNameOrComponent: any, props: any = {}, ...children: any[]) => {
  // if tagNameOrComponent is a component
  if (typeof tagNameOrComponent !== 'string')
    return { c: tagNameOrComponent, props: { ...props, children: children } }

  let ref

  const element =
    tagNameOrComponent === 'svg'
      ? (hNS('svg') as SVGElement)
      : (doc.createElement(tagNameOrComponent) as HTMLElement)

  // check if the element includes the event (for example 'oninput')
  const isEvent = (el: HTMLElement | any, p: string) => {
    // check if the event begins with 'on'
    if (0 !== p.indexOf('on')) return false

    // check if the event is present in the element as object (null) or as function
    return typeof el[p] === 'object' || typeof el[p] === 'function'
  }

  for (const p in props) {
    // https://stackoverflow.com/a/45205645/12656855
    // style object to style string
    if (p === 'style' && typeof props[p] === 'object') {
      const styles = Object.keys(props[p])
        .map(k => `${k}:${props[p][k]}`)
        .join(';')
        .replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
      props[p] = `${styles};`
    }

    // handel ref
    if (p === 'ref') ref = props[p]
    // handle events
    else if (isEvent(element, p.toLowerCase()))
      element.addEventListener(p.toLowerCase().substring(2), (e: any) => props[p](e))
    // dangerouslySetInnerHTML
    else if (p === 'dangerouslySetInnerHTML' && props[p].__html) {
      const fragment = doc.createElement('fragment')
      fragment.innerHTML = props[p].__html
      element.appendChild(fragment)
    }
    // className
    else if (/^className$/i.test(p)) element.setAttribute('class', props[p])
    // setAttribute
    else if (props[p] !== undefined) element.setAttribute(p, props[p])
  }

  appendChildren(element, children)
  if (ref) ref(element)
  return element as any
}

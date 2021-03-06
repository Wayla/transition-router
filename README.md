transition-router
=================

A router which takes care of adding/removing elements and transitioning them on route changes.

Just return a DOM element, define a transition on it, we'll do the rest!

## Demo
  
  [http://wayla.github.io/transition-router](http://wayla.github.io/transition-router)
  
  *Ideal viewing environment: iOS 7 Safari

## Use Cases
- The use case for which the transition-router was originally developed was Wayla's single-page, mobile web app. Basically, each route change transitioned in a new full-screen "page", transitioning out the current page. Think native app feel in mobile web.

## Usage

### Setup

You'll need an element to contain the elements that the router adds to the DOM. Something like:

```
<body>
 <div id='page-container'></div>
</body>
```

would work.

The javascript you'll need might look like this:

```
TransitionRouter = require('transition-router') //componentjs require statement
transitionRouter = new TransitionRouter({
  containerElement : document.querySelector('#page-container')
})

//create a route whose handler returns a DOM element

transitionRouter.get('/', function () {
    el = /* logic to generate a DOM element */
    el.classList.add('page-1') /* make sure that the el has a css class - this is necessary to implement the transition */
    return el
})
```

The transitionRouter will apply the .show css class to el, triggering the transition.
So define a transition on a property on the el:


```
.page-1 {
    transition        : -webkit-transform 1s linear;
    -webkit-transform : translate3d(100%,0,0); /* pre-transition state */
}

.page-1.show {
    -webkit-transform : translate3d(0,0,0); /* post-transition state */
}
```

You'll also need to make sure that each `el` is `position:absolute` in order for the overlay effect of the transitions to work properly:

```
.page-1 {
    transition        : -webkit-transform 1s linear;
    -webkit-transform : translate3d(100%,0,0); /* pre-transition state */

    position:absolute;
}
```

### Invoking routes

Routes are invoked by either
- `dispatch()`
- `go()` (which implicitly calls `dispatch()`)

The difference between `dispatch()` and `go()` is that `go()` will also call `history.pushState()` and persist the current route to `localStorage` if the `persistance` option is enabled.

### Options

- persistence (default : true)
  ```
  new TransitionRouter({persistence: true, containerElement : el})
  ```

  persists the current route to localStorage. (Any time the app is launched -- actually when should this happen?), fetches the last route stored in localStorage and `go()`'s to that route.
  

## Features

- Expressjs-style middleware
  
```
router.get('/my-route', middleware, routeHandler)
```

## Gotchas


- The router will not work if there there is no transition that occurs when the .show class is added and removed. The reason is that the router listens for `transitionend` before adding and removing elements.
  
   ex: If you've only defined webkit-transition and you try to run the app in Firefox, you'll probably notice that
`window.history.back()` and the back button don't work.

## Development

  To install development dependencies, run `npm install`

  To build a new release, run `./build-release`


## A bit of history

This codebase:

- is a copy-paste-modify of https://github.com/component/router/blob/master/index.js. Big upps to https://github.com/visionmedia.
- takes the column concept and overarching architecture from https://github.com/xcoderzach/transition-router. Enormously huge upps to https://github.com/xcoderzach/

The principal differences between transition-router and component/router are:

- `.after()` has been disabled
- `.before()` has been renamed to generateNextElement()
- `dispatch()` no longer calls `teardown()` as `animateBetweenPages()` does the work of removing the existing element

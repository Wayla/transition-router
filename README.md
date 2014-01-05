transition-router
=================

A router which takes care of adding/removing elements and transitioning them on route changes.

Just return a DOM element, define a transition on it, we'll do the rest!

## Demo
  
  [http://wayla.github.io/transition-router](http://wayla.github.io/transition-router)

## Usage

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
    el.classList.add('el-class') /* make sure that the el has a css class - this is necessary to implement the transition */
    return el
})
```

The transitionRouter will apply the .show css class to el, triggering the transition.
So define a transition on a property of the el like so:


```
.el-class {
    transition        : -webkit-transform 1s linear;
    -webkit-transform : translate3d(100%,0,0); /* pre-transition state */
}

.el-class.show {
    -webkit-transform : translate3d(0,0,0); /* post-transition state */
}
```

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
- takes the column concept from https://github.com/xcoderzach/transition-router. Enormously huge upps to https://github.com/xcoderzach/

The principal differences between transition-router and component/router are:

- `.after()` has been disabled
- `.before()` has been renamed to generateNextElement()
- `dispatch()` no longer calls `teardown()` as `animateBetweenPages()` does the work of removing the existing element

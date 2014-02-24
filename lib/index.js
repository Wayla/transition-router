var Promise = require('micropromise')
  , Route = require('route')
  , PromiseQueue = require('./promise-queue')
  , persistence = require('./persistence')
  , mixin = require('mixin')
  , everPushedSomething
  , initialUrl = location.href
  , animationQueue //a queue of calls to animateBetweenPages()
  , elementsOpenInBackground = [] // a list of pages which aren't visible, but are still in the DOM (to make back()'ing appear faster)
                                  // currently only 0 or 1 page can be in the background at a time
                                  // this limit is enforced by next() which tries to pop() an element from
                                  // elementsOpenInBackground every time it (next()) is called

/****
 Note that currently, the parallel ordering isnt being used at all!
*****/

//generateNextElement() should return an element which will be animated into the viewport

//the PromiseQueue is used to ensureß that only one route transion occurs at a time :)

animationQueue = new PromiseQueue

module.exports = Router

function Router(options) {

  options.timeout = options.timeout || (30 * 60 * 1000) //30 minutes

  if (!options.containerElement) {throw 'containerElement must be defined'}

  this.containerElement = options.containerElement
  this.persistence = options.persistence || false
  this.setPointerEventsToNoneWhileAnimating = options.setPointerEventsToNoneWhileAnimating || true

  if (this.persistence) mixin(this,persistence())

  this.routes = []

  if(this.persistence && this.lastAccessTimestamp() && (Date.now() - this.lastAccessTimestamp()) > options.timeout) {
    this.expire()
  }


  //https://developer.mozilla.org/en-US/docs/Web/API/window.onpopstate
  /* Browsers tend to handle the popstate event differently on page load. Chrome and Safari always emit a popstate event on page load, but Firefox doesn't. */


  //Also, we're assuming that popstate either means:
  //1) initial load
  //2) browser back
  // it's also possible for popstate to mean browser forward, or browser forward/back more than 1 step
  // but let's try not to do that

  window.addEventListener('popstate', function(event) {

    var onloadPop = !everPushedSomething && location.href == initialUrl
    everPushedSomething = true

    if (onloadPop) {

      if (this.persistence) {
        this.restore() // this should maybe be true only if navigator.standalone
      }
      else {
        this.dispatch(window.document.location.pathname, { firstPageOfBrowsingSession : true })
      }

      return
    }
    else {

      if (this.persistence) this.popLastHistoryEntry()

      this.dispatch(window.document.location.pathname, { direction : 'back'})

    }



    //if (this.persistence) this.persist(window.document.location.pathname)

  }.bind(this))

}

Router.prototype.replaceState = function(path) {
   history.replaceState({}, "title", path)
   if(this.persistence) this.replaceLastHistoryEntry(path) //TODO: this would only be availible if persistence were true, need to abstract history out of persistence...
}

Router.prototype.replaceGo = function(path,metadata) {

  //todo: maybe i need `everPushedSomething = true` ?

  this.replaceState(path)
  this.dispatch(path,metadata)
}

Router.prototype.goWithoutReplace = function(path,metadata) {

  //todo: maybe i need `everPushedSomething = true` ?

  this.dispatch(path,metadata)
}

Router.prototype.go = function(path,metadata) {

  everPushedSomething = true

  if (this.persistence) this.persist(path)
  history.pushState({}, "title", path)
  this.dispatch(path,metadata)

}

//can invoke in two different ways:
//get(route, handler)
//get(route, middleware, handler)

Router.prototype.get = function(){

  var path = arguments[0]
    , middleware
    , generateNextElement //aka the route handler

  //get(route, handler)
  if (arguments.length === 2) {
    middleware = undefined
    generateNextElement = arguments[1]
  }
  //get(route, middleware, handler)
  else if (arguments.length === 3) {
    middleware = arguments[1]
    generateNextElement = arguments[2]
  }
  else {
    throw "invalid number of arguments"
  }

  var route = new Route(path)
  this.routes.push(route)
  route.before(function (options) {

    var args = options.args
    var metadata = options.metadata || {}
    var direction = metadata.direction || 'forward'


    var next = function () {

    console.log('enqueing', path)

      //so we dont execute the transition right away, we queue it up until any current animations finish (though most probably the queue is empty and it will get executed right away)
      animationQueue.enqueue(function () {

        var elementOpenInBackground = elementsOpenInBackground.length ? elementsOpenInBackground.pop() : undefined //elementsOpenInBackground.length currently can be at most 1
        // The idea is whenever a route handler is called, we will call elementsOpenInBackground.pop()
        // Calling elementsOpenInBackground.pop() when direction === back will reveal the DOM element in the background (if one exists)
        // ""         ""                 ""       when direction === forward will result in that background element's removal from the DOM

        if (elementOpenInBackground && direction === 'forward') {
          this.containerElement.removeChild(elementOpenInBackground)
          elementOpenInBackground = undefined

          //sanity check - just making sure that the there are no elements open in the background when going forward

          if (elementsOpenInBackground.length > 0) {
            console.warn('there should be no elements open in the background. Something is wrong...')
          }
        }

        var nextElement = (direction === 'back' && elementOpenInBackground) ? elementOpenInBackground : generateNextElement.apply(null, args)
        var currentElement =  this.containerElement.children.length ? this.containerElement.lastElementChild : null
                              //  probably a better way to determine this that doesnt depend on the DOM (i.e. children[0])
                              //  null === there isn't an existing page (i.e. initial load)
                              //  basically we're saying that this.containerElement.children.length === 0 means that it's initial load

        //setting pointerEventsToNone helps to deal with the issue of double tapping back buttons

        if (this.setPointerEventsToNoneWhileAnimating) {
          nextElement.style.pointerEvents = 'none'
          if (currentElement) { currentElement.style.pointerEvents = 'none' }
        }


        return animateBetweenPages({
          direction                            : direction,
          order                                : elementOpenInBackground ? 'reshowThenRemove' : 'addThenRemove', //if going back and the previous page is still in the DOM, then reshowThenRemove, otherwise, addThenRemove
                                                                                                                 //elementOpenInBackground should always be false when direction===forward
          nextElement                          : nextElement,
          currentElement                       : currentElement,
          containerElement                     : this.containerElement,
          keepCurrentPageInBackground          : metadata.keepCurrentPageInBackground,
          setPointerEventsToNoneWhileAnimating : this.setPointerEventsToNoneWhileAnimating
        })

      }.bind(this))
    }.bind(this)
    //maybe i should use https://github.com/segmentio/ware
    if (middleware) middleware(next, metadata) //the middleware is supposed to call next() - if there's no middleware, then we call next() ourselves
    else next()
  }.bind(this))
  return route
}


Router.prototype.dispatch = function(path, metadata){

  var ret
  for (var i = 0; i < this.routes.length; i++) {
    var route = this.routes[i]
    if (ret = route.match(path)) {
      this.route = route //TODO: do we need to set this.route and this.args? - BS 1/5/2013
      this.args = ret.args
      route.call('before', [{ args : ret.args, metadata : metadata}])
      break
    }
  }
}


function animateBetweenPages(options) {

  var finishedAnimatingPromise = new Promise // Helps to keep two route transitions from happening at the same time
                                             // and helps ensure that one route change finishes before the next one occurs
                                             // In the future, maybe we can cancel route changes instead of waiting for them to finish?
                                             // Used by the PromiseQueue

  console.log('route options', options)

  options = options || {}

  options.order = options.order || (function () { throw 'options.order must be defined'})()

  var nextElement                          = options.nextElement
    , currentElement                       = options.currentElement //null in the case of initial load
    , containerElement                     = options.containerElement
    , direction                            = options.direction
    , keepCurrentPageInBackground          = options.keepCurrentPageInBackground
    , setPointerEventsToNoneWhileAnimating = options.setPointerEventsToNoneWhileAnimating

  var Classes = {
    Show : 'show' //i'd like to use .adding and .removing, but the current css markup is using .show a lot
  }



  /*
    promises and event listeners
  */

  //is it cool that we assume that these promises will only be resolved once?

  var nextElementAnimationEndPromise = new Promise
    , currentElementAnimationEndPromise = new Promise

  if (!currentElement) {currentElementAnimationEndPromise.fulfill()} //in the case of initial load, just fulfill the promise right away. otherwise the promise gets resolved when animationend occurs

  currentElement && currentElement.addEventListener('transitionend', function (event) { //no event listener if currentElement === null
    if (event.srcElement !== currentElement) return //a transition may have ended on a child of the current element
    currentElementAnimationEndPromise.fulfill()
  })

  var nextElementAnimationEndListener = function (event) {
    if (event.srcElement !== nextElement) return //a transition may have ended on a child of the nextElement
    nextElement.removeEventListener('transitionend', nextElementAnimationEndListener)
    nextElementAnimationEndPromise.fulfill()
  }

  nextElement.addEventListener('transitionend', nextElementAnimationEndListener)

  /*
    end promises and event listeners
  */

  switch (options.order){
    case 'reshowThenRemove': //the nextElement is already in the DOM, we'll reapply .show to it then remove the current element

        //nextElement really is the same as elementInBackground

        //keepCurrentPageInBackground doesnt apply to this ordering

        if (keepCurrentPageInBackground) { console.warn('keepCurrentPageInBackground doesnt apply to reshowThenRemove so setting it to something truthy has no effect') }

        //not sure when currentElement would be null/undefined, but if it is, then dont animate at all

        if (!currentElement) {
          finishedAnimatingPromise.fulfill()
          return
        }

        requestAnimationFrame(function () {

          currentElementAnimationEndPromise
            .then(function () {
              containerElement.removeChild(currentElement)
              finishedAnimatingPromise.fulfill()
            })

          currentElement.classList.remove(Classes.Show)


        })

      break
    case 'parallel':

      requestAnimationFrame(function () {


        if (direction === 'back') {
          containerElement.insertBefore(nextElement, containerElement.firstChild) //does this need to be done in a requestAnimationFrame that is seperate from the one in which .adding is added?
        }
        else {
          containerElement.appendChild(nextElement) //does this need to be done in a requestAnimationFrame that is seperate from the one in which .adding is added?
        }

        currentElement && currentElement.classList.remove(Classes.Show)  //Classes.Show should specify an outro transition - if it doesnt, the currentElementAnimationEndPromise will never get resolved
        requestAnimationFrame(function () { nextElement.classList.add(Classes.Show) }) //without the requestAnimationFrame, the loading animation never occurs

        currentElementAnimationEndPromise //if an element doesnt have an animation, i dont think this promise will ever get resolved...
          .then(function () {
            currentElement && !keepCurrentPageInBackground && containerElement.removeChild(currentElement)
            currentElement && keepCurrentPageInBackground && elementsOpenInBackground.push(currentElement)
          })

        nextElementAnimationEndPromise
          .then(function () {
            //nextElement.classList.remove(Classes.Adding)
          })

        // Since we are using micropromises, we dont have a Q.all() (see https://github.com/kriskowal/q),
        // which is basically what the following statement represents. The order in which these promises
        // are fulfilled doesn't matter.

        currentElementAnimationEndPromise
          .then(function () {return nextElementAnimationEndPromise})
          .then(function (){ finishedAnimatingPromise.fulfill()})

      })

    break
  case 'addThenRemove': //the nextElement will go through its add transition first, then the currentElement will go through its remove transition
                        //obviously (I guess), the currentElement does get removed until it finishes its remove transition

    requestAnimationFrame(function () {



      if (direction === 'back') {


        nextElement.classList.add(Classes.Show) // no need to animate the next element in but we do need to make sure that the .show class is applied to it
                                                // adding the .show class to the element before it's inserted into the DOM ensures that the transition
                                                // defined on the element does not occur

        containerElement.insertBefore(nextElement, containerElement.firstChild)

        currentElementAnimationEndPromise
          .then(function () {
            currentElement && !keepCurrentPageInBackground && containerElement.removeChild(currentElement)
            currentElement && keepCurrentPageInBackground && elementsOpenInBackground.push(currentElement)
            finishedAnimatingPromise.fulfill()
          })

        currentElement && currentElement.classList.remove(Classes.Show)

      }
      else { //direction === forward

        // in addThenRemove, if moving forward, there's no need to animate out the currentElement since it will *probably* be hidden by the nextElement
        // keeping the .show class on the element also helps with reshowThenRemove as we wont have to animate in the background element (it will already have its .show class on)

        containerElement.appendChild(nextElement)

        requestAnimationFrame(function () { nextElement.classList.add(Classes.Show) }) //remember that without the .show class, the element will be positioned off screen

        nextElementAnimationEndPromise
          .then(function () {
            console.log('removing', currentElement)
            currentElement && !keepCurrentPageInBackground && containerElement.removeChild(currentElement)
            currentElement && keepCurrentPageInBackground && elementsOpenInBackground.push(currentElement)
            finishedAnimatingPromise.fulfill()
          })

      }




     })

    break
  default:
    throw 'invalid order ' + options.order

  }

  //when the animation has finished, restore pointer events!

  finishedAnimatingPromise
    .then(function () {
      nextElement.style.pointerEvents = 'auto'
    })

  return finishedAnimatingPromise

}

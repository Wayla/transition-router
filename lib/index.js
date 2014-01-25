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



//generateNextElement() should return an element which will be animated into the viewport

//the PromiseQueue is used to ebsure that only one route transion occurs at a time :)

animationQueue = new PromiseQueue

module.exports = Router

function Router(options) {

  if (!options.containerElement) {throw 'containerElement must be defined'}

  this.containerElement = options.containerElement
  this.persistence = options.persistence || false

  if (this.persistence) mixin(this,persistence())

  this.routes = []

  //should this stuff go in here?

  this.lastPath = document.location.pathname + document.location.search

  if (this.persistence) this.restore()

  window.addEventListener('popstate', function(event) {
    var onloadPop = !everPushedSomething && location.href == initialUrl
    everPushedSomething = true
    if (onloadPop) return

    this.dispatch(window.document.location.pathname, { direction : 'back'})
    if (this.persistence) this.persist(window.document.location.pathname)

  }.bind(this))

}

Router.prototype.replaceState = function(path) {
   history.replaceState({}, "title", path)
   lastPath = path
}

Router.prototype.go = function(path,metadata) {

  everPushedSomething = true

  if(this.lastPath !== path) {
    if (this.persistence) this.persist(path)
    history.pushState({}, "title", path)
    this.dispatch(path,metadata)
  }

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

      //so we dont execute the transition right away, we queue it up until any current animations finish (though most probably the queue is empty and it will get executed right away)
      animationQueue.enqueue(function () { return animateBetweenPages({
        direction            :   direction,
        order                :   elementOpenInBackground ? 'reshowThenRemove' : 'addThenRemove', //if going back and the previous page is still in the DOM, then reshowThenRemove, otherwise, addThenRemove
                                                                                                 //elementOpenInBackground should always be false when direction===forward
        nextElement          :   nextElement,
        currentElement       :   this.containerElement.children.length ? this.containerElement.lastElementChild : null,
                             //  probably a better way to determine this that doesnt depend on the DOM (i.e. children[0])
                             //  null === there isn't an existing page (i.e. initial load)
                             //  basically we're saying that this.containerElement.children.length === 0 means that it's initial load
        containerElement     :   this.containerElement,
        keepCurrentPageInBackground :   metadata.keepCurrentPageInBackground
      }) }.bind(this))
    }.bind(this)
    //maybe i should use https://github.com/segmentio/ware
    if (middleware) middleware(next) //the middleware is supposed to call next() - if there's no middleware, then we call next() ourselves
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

  var nextElement                 = options.nextElement
    , currentElement              = options.currentElement //null in the case of initial load
    , containerElement            = options.containerElement
    , direction                   = options.direction
    , keepCurrentPageInBackground = options.keepCurrentPageInBackground

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

  currentElement && currentElement.addEventListener('transitionend', function () { //no event listener if currentElement === null
    currentElementAnimationEndPromise.fulfill()
  })

  var nextElementAnimationEndListener = function () {
    nextElement.removeEventListener('transitionend', nextElementAnimationEndListener)
    nextElementAnimationEndPromise.fulfill()
  }

  nextElement.addEventListener('transitionend', nextElementAnimationEndListener)

  /*
    end promises and event listeners
  */

  switch (options.order){
    case 'reshowThenRemove': //the nextElement is already in the DOM, we'll reapply .show to it then remove the current element
        // var previousPage = elementsOpenInBackground.pop()
        // previousPage.classList.add('show')
        // this.containerElement.lastChild.classList.remove('show')
        // setTimeout(function () {this.containerElement.removeChild(this.containerElement.lastChild)}.bind(this),2000)


        //keepCurrentPageInBackground doesnt apply to this ordering

        if (keepCurrentPageInBackground) { console.warn('keepCurrentPageInBackground doesnt apply to reshowThenRemove so setting it to something truthy has no effect') }

        requestAnimationFrame(function () {

          //TODO: we probably should not have to animate in the nextElement
          requestAnimationFrame(function () { nextElement.classList.add(Classes.Show) })

          currentElementAnimationEndPromise
            .then(function () {
              currentElement && containerElement.removeChild(currentElement)
              finishedAnimatingPromise.fulfill()
            })

          nextElementAnimationEndPromise
            .then(function () {
              //currentElement && currentElement.classList.remove(Classes.Adding)
              currentElement && currentElement.classList.remove(Classes.Show)
            })

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
            currentElement && containerElement.removeChild(currentElement)
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
        containerElement.insertBefore(nextElement, containerElement.firstChild)
      }
      else {
        containerElement.appendChild(nextElement)
      }

      requestAnimationFrame(function () { nextElement.classList.add(Classes.Show) })

      currentElementAnimationEndPromise
        .then(function () {
          //TODO: add the keepCurrentPageInBackground logic to parallel
          currentElement && !keepCurrentPageInBackground && containerElement.removeChild(currentElement)
          currentElement && keepCurrentPageInBackground && elementsOpenInBackground.push(currentElement)
          finishedAnimatingPromise.fulfill()
        })

      nextElementAnimationEndPromise
        .then(function () {
          //currentElement && currentElement.classList.remove(Classes.Adding)
          currentElement && currentElement.classList.remove(Classes.Show)
        })

     })

    break
  default:
    throw 'invalid order ' + options.order

  }

  return finishedAnimatingPromise

}

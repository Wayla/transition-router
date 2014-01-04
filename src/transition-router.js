var states //would be ideal if we could store state
           //in the pushState state object - but apparently
           //there's a size limit
           //https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Manipulating_the_browser_history
  , Promise = require('micropromise')
  , Route = require('route')
  , PromiseQueue = require('./promise-queue')
  , persistence = require('./persistence')
  , mixin = require('mixin')
  , everPushedSomething
  , initialUrl = location.href
  , animationQueue //a queue of calls to animateBetweenPages()

//generateNextElement() should return an element which will be animated into the viewport

//the PromiseQueue is used to ebsure that only one route transion occurs at a time :)

animationQueue = new PromiseQueue

module.exports = Router

function Router(options) {

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

Router.prototype.go = function(path,metadata) {

  everPushedSomething = true

  if(this.lastPath !== path) {
    if (this.persistence) persist(path)
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
    , generateNextElement

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



    var next = function () {
      var nextElement
      nextElement = generateNextElement.apply(null, args)
      //so we dont execute the transition right away, we queue it up until any current animations finish (though most probably the queue is empty and it will get executed right away)
      animationQueue.enqueue(function () { return animateBetweenPages({
        direction : metadata.direction,
        nextElement : nextElement,
        currentElement : this.containerElement.children[0] || null, //probably a better way to determine this that doesnt depend on the DOM (i.e. children[0])
                                                                    //null === tehre isn't an existing page (i.e. initial load)
                                                                    //basically we're saying that this.containerElement.children.length === 0 means that it's initial load
        containerElement : this.containerElement
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
      this.route = route
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



  options = options || {}

  options.order = options.order || 'addThenRemove'
  //options.keepCurrentElement = options.keepCurrentElement || false //TODO: dont think this is doing anything ATM

  var nextElement       = options.nextElement
    , currentElement    = options.currentElement //null in the case of initial load
    , containerElement  = options.containerElement
    , direction         = options.direction

  //elementCache isnt currently being used
  //var elementCache = {} //probably better to use like Component.set or ecma sets if such a thing exists
                        //elementCache will only be used if options.keepCurrentElement === true

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
  // not sure there's a use case for removeThenAdd, so commenting out
  //
  // case 'removeThenAdd': //the currentElement will go through its remove transition first, then the nextElement will go through its add transition.
  //                       //the currentElement does get added right away though

  //   requestAnimationFrame(function () {

  //     currentElement.classList.remove(Classes.Show)

  //     currentElementAnimationEndPromise
  //       .then(function () {
  //         containerElement.removeChild(currentElement)
  //         containerElement.appendChild(nextElement)
  //         requestAnimationFrame(function () { nextElement.classList.add(Classes.Show) })
  //       })

  //     nextElementAnimationEndPromise
  //       .then(function () {
  //         //nextElement.classList.remove(Classes.Adding)
  //       })

  //   })

  //   break
  case 'addThenRemove': //the nextElement will go through its add transition first, then the currentElement will go through its remove transition
                        //obviously (I guess), the currentElement does get removed until it finishes its remove transition

    requestAnimationFrame(function () {

      //TODO: incorporate this back functionality into the other orders
      if (direction === 'back') {
        containerElement.insertBefore(nextElement, containerElement.firstChild)
      }
      else {
        containerElement.appendChild(nextElement)
      }

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
  default:
    throw 'invalid order ' + options.order

  }

  return finishedAnimatingPromise

}

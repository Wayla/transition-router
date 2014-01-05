module.exports = PromiseQueue

/******************************************

The PromiseQueue will execute promise-producing functions:
- in the order they are added to the PromiseQueue
- one at a time - i.e. the next promise-producing function in the PromiseQueue
  will only be called when the current promise is resolved.

*******************************************/

function PromiseQueue() {

  var _queueOfPromiseProducingFunctions = []
  var _currentlyExecutingPromise = undefined

  function _executeNextPromiseProducingFunction() {

    //assumption: _queueOfPromiseProducingFunctions.length > 0

    var promiseProducingFunctionToExecute = _queueOfPromiseProducingFunctions.splice(0,1)[0]
    _currentlyExecutingPromise = promiseProducingFunctionToExecute()
    _currentlyExecutingPromise
      .then(function () {
        if (_queueOfPromiseProducingFunctions.length) {
          _executeNextPromiseProducingFunction()
        }
        else {
          _currentlyExecutingPromise = undefined
          //then wait for the next call to enqueue()
        }
      })
  }

  this.enqueue = function (promiseProducingFunction) {
    if (!_currentlyExecutingPromise && !_queueOfPromiseProducingFunctions.length) { //may be redundant to also check for _queueOfPromiseProducingFunctions.length - also we'd be stuck if _queueOfPromiseProducingFunctions.length > 0 but _currentlyExecutingPromise === undefined
      _queueOfPromiseProducingFunctions.push(promiseProducingFunction)
      _executeNextPromiseProducingFunction()
      return
    }
    else {
      _queueOfPromiseProducingFunctions.push(promiseProducingFunction)
      return
    }

  }

}

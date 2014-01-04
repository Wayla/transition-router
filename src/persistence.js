/**************************************************************************

Optional mixin offering localStorage persistence of the last route visited.

The mixin supports a `timeout` parameter which controls the amount of time
the last route is persisted.

***************************************************************************/

var LocalStorageKeyPrefix = 'TransitionRouter::726924c5::' // partial guid is meant to help
                                                             // avoid collisions with other data
                                                             // in localStorage

var LocalStorageKeys = {
  LastPath          : LocalStorageKeyPrefix + 'LastPath',
  LastPathTimestamp : LocalStorageKeyPrefix + 'LastPathTimestamp'
}

module.exports = function (options) {

  options = options || {}

  options.timeout = options.timeout || (30 * 60 * 1000) //30 minutes

  function restore() {
    var storedPath = window.localStorage.getItem(LocalStorageKeys.LastPath)
      , storedPathTimestamp = window.localStorage.getItem(LocalStorageKeys.LastPathTimestamp)

    //I forget exactly why I'm using a setTimeout here...
    setTimeout(function () {

      //TODO: remove the window.navigator.standalone stuff and maybe even the this.lastPath
      if(window.navigator.standalone && this.lastPath === '/' && storedPathTimestamp &&
         storedPathTimestamp < Date.now() + options.timeout) {

        history.replaceState({}, "title", storedPath)
        this.lastPath = storedPath //TODO: this line cant be in here. In the case wher epersistence is turned off, lastPath still needs to be updated.
        this.dispatch(storedPath)
      } else {
        this.dispatch(this.lastPath)
      }

    }.bind(this))
  }

  function persist(path) {
    window.localStorage.setItem(LocalStorageKeys.LastPath, path)
    window.localStorage.setItem(LocalStorageKeys.LastPathTimestamp, Date.now())
    this.lastPath = path //TODO: can this line be in here? In the case where persistence is turned off, lastPath still needs to be updated.
  }

  return {
    restore : restore,
    persist : persist
  }
}

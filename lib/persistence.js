/**************************************************************************

Optional mixin offering localStorage persistence of the last route visited.

The mixin supports a `timeout` parameter which controls the amount of time
the last route is persisted.

***************************************************************************/

var LocalStorageKeyPrefix = 'TransitionRouter::726924c5::' // partial guid is meant to help
                                                             // avoid collisions with other data
                                                             // in localStorage

var HistoryEntriesLimit = 4

var LocalStorageKeys = {
  LastAccessTimestamp : LocalStorageKeyPrefix + 'LastAccessTimestamp',
  History             : LocalStorageKeyPrefix + 'History'
}


module.exports = function () {

  //TODO: maybe restore should be its own module?

  function restore() {

      var persistedHistory = getPersistedHistory()

      persistedHistory
        .forEach(function (path) {
          window.history.pushState({}, "title",path)
        })

      if (persistedHistory.length) {
        this.dispatch(persistedHistory[persistedHistory.length-1], { firstPageOfBrowsingSession : true })
      }
      else {
        persist('/')
        this.dispatch('/', { firstPageOfBrowsingSession : true })
      }

  }



  function persist(path) {

    touchLastAccessTimestamp()

    var persistedHistory = getPersistedHistory()

    persistedHistory.push(path)

    persistedHistory = persistedHistory.splice(-1 * HistoryEntriesLimit, HistoryEntriesLimit) // take the last X entries

    window.localStorage.setItem(LocalStorageKeys.History, JSON.stringify(persistedHistory))

  }

  function expire() {

    window.localStorage.removeItem(LocalStorageKeys.History)
    window.localStorage.removeItem(LocalStorageKeys.LastAccessTimestamp)
  }

  function getPersistedHistory() {
    var persistedHistoryStringified = window.localStorage.getItem(LocalStorageKeys.History) || "[]"
      , persistedHistory = JSON.parse(persistedHistoryStringified)

    return persistedHistory
  }

  function touchLastAccessTimestamp() {
    window.localStorage.setItem(LocalStorageKeys.LastAccessTimestamp, Date.now())
  }

  function lastAccessTimestamp() {
    var lastAccessTimestamp = window.localStorage.getItem(LocalStorageKeys.LastAccessTimestamp)

    return lastAccessTimestamp ? +lastAccessTimestamp : 0
  }

  function replaceLastHistoryEntry(path) {
    var persistedHistory = getPersistedHistory()

    persistedHistory.splice(-1,1)
    persistedHistory.push(path)

    window.localStorage.setItem(LocalStorageKeys.History, JSON.stringify(persistedHistory))
  }

  function lastPath() {
    var persistedHistory = getPersistedHistory()

    return persistedHistory.length ? persistedHistory[persistedHistory.length - 1] : undefined

  }

  function popLastHistoryEntry() {

    var persistedHistory = getPersistedHistory()

    persistedHistory.pop()

    window.localStorage.setItem(LocalStorageKeys.History, JSON.stringify(persistedHistory))
  }

  return {
    restore : restore,
    persist : persist,
    expire  : expire,
    persistedHistory : getPersistedHistory,
    popLastHistoryEntry : popLastHistoryEntry,
    lastPath : lastPath,
    replaceLastHistoryEntry : replaceLastHistoryEntry,
    lastAccessTimestamp : lastAccessTimestamp,
    touchLastAccessTimestamp : touchLastAccessTimestamp
  }
}

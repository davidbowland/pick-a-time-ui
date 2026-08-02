const { configure } = require('@testing-library/dom')

// Testing Library's async helpers (`findBy*`, `waitFor`) give up after 1000ms of wall-clock time by
// default, and Jest gives up on a whole test after 5000ms. Neither budget is about the code under
// test -- both just measure how fast this machine happened to be. When several Jest workers (or
// several concurrent Jest runs) compete for cores, a worker can stall long enough to blow through
// both, and correct tests fail with "Unable to find an element..." or "Exceeded timeout of 5000 ms"
// even though the element does appear and the assertions are right. Raising the budgets keeps the
// suite deterministic under load; it does not weaken any assertion, since a genuinely broken
// expectation still fails, just later.
configure({ asyncUtilTimeout: 5000 })

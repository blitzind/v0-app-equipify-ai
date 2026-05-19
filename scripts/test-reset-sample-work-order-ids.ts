import assert from "node:assert/strict"
import { mergeSampleWorkOrderIds } from "../lib/demo-data/merge-sample-work-order-ids"

function testMergeDedupesAndCombines() {
  const merged = mergeSampleWorkOrderIds(["a", "b"], ["b", "c"])
  assert.deepEqual(merged.sort(), ["a", "b", "c"])
}

function testMergeEmpty() {
  assert.deepEqual(mergeSampleWorkOrderIds([], []), [])
  assert.deepEqual(mergeSampleWorkOrderIds(["x"], []), ["x"])
}

testMergeDedupesAndCombines()
testMergeEmpty()
console.log("test-reset-sample-work-order-ids: ok")

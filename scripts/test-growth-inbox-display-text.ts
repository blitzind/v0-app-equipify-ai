import assert from "node:assert/strict"
import { displayInboxSubject, normalizeInboxDisplayText } from "../lib/growth/inbox/inbox-display-text"

function main() {
  assert.equal(normalizeInboxDisplayText("  hello  "), "hello")
  assert.equal(normalizeInboxDisplayText(null), "")
  assert.equal(displayInboxSubject(""), "Untitled thread")

  const mojibake = "WIKUS Saw Â€Â¢ quick ops note"
  const fixed = normalizeInboxDisplayText(mojibake)
  assert.doesNotMatch(fixed, /Â€Â¢/)
  assert.match(fixed, /WIKUS Saw/)
  assert.match(fixed, /quick ops note/)

  assert.equal(normalizeInboxDisplayText("Plain subject line"), "Plain subject line")
  assert.equal(normalizeInboxDisplayText("Smart â€™ quote"), "Smart ' quote")

  console.log("growth-inbox-display-text: all checks passed")
}

main()

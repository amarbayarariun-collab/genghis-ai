import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasLatinForTranslit, latinToCyrillicMn } from "./transliterate-mn.ts";

describe("latinToCyrillicMn", () => {
  it("converts common greeting words", () => {
    assert.equal(latinToCyrillicMn("sain baina uu"), "сайн байна уу");
    assert.equal(latinToCyrillicMn("bayarlalaa"), "баярлалаа");
    assert.equal(latinToCyrillicMn("mongol"), "монгол");
  });

  it("maps ө and ү via umlaut and apostrophe", () => {
    assert.equal(latinToCyrillicMn("khün"), "хүн");
    assert.equal(latinToCyrillicMn("khu'n"), "хүн");
    assert.equal(latinToCyrillicMn("övdög"), "өвдөг");
    assert.equal(latinToCyrillicMn("o'vdog"), "өвдог");
    assert.equal(latinToCyrillicMn("üner"), "үнэр");
    assert.equal(latinToCyrillicMn("u'ner"), "үнэр");
  });

  it("maps kh → х", () => {
    assert.equal(latinToCyrillicMn("khan"), "хан");
    assert.equal(latinToCyrillicMn("Kharkhorin"), "Хархорин");
  });

  it("maps ts → ц", () => {
    assert.equal(latinToCyrillicMn("tsai"), "цай");
    assert.equal(latinToCyrillicMn("tsagaan"), "цагаан");
  });

  it("maps ch → ч", () => {
    assert.equal(latinToCyrillicMn("chono"), "чоно");
    assert.equal(latinToCyrillicMn("chuluu"), "чулуу");
  });

  it("maps sh → ш", () => {
    assert.equal(latinToCyrillicMn("shono"), "шоно");
    assert.equal(latinToCyrillicMn("shawar"), "шавар");
  });

  it("maps ya → я, yo → ё, yu → ю", () => {
    assert.equal(latinToCyrillicMn("yamaa"), "ямаа");
    assert.equal(latinToCyrillicMn("yos"), "ёс");
    assert.equal(latinToCyrillicMn("yurt"), "юрт");
    assert.equal(latinToCyrillicMn("yu"), "ю");
  });

  it("preserves Cyrillic and punctuation", () => {
    assert.equal(latinToCyrillicMn("Сайн uu!"), "Сайн уу!");
    assert.equal(latinToCyrillicMn("123 mongol."), "123 монгол.");
  });

  it("detects Latin that needs transliteration", () => {
    assert.equal(hasLatinForTranslit("sain"), true);
    assert.equal(hasLatinForTranslit("сайн"), false);
  });
});

import { describe, it, expect } from "vitest";
import { getChallengeRatingXP, getProficiencyBonus, parseCR } from "../src/ai/validation/cr-xp-mapping";

describe("getChallengeRatingXP", () => {
  it("returns 10 for CR 0", () => {
    expect(getChallengeRatingXP("0")).toBe(10);
  });
  it("returns 25 for CR 1/8", () => {
    expect(getChallengeRatingXP("1/8")).toBe(25);
  });
  it("returns 1800 for CR 5", () => {
    expect(getChallengeRatingXP("5")).toBe(1800);
  });
  it("returns 155000 for CR 30", () => {
    expect(getChallengeRatingXP("30")).toBe(155000);
  });
  it("returns 0 for unknown CR", () => {
    expect(getChallengeRatingXP("99")).toBe(0);
  });
});

describe("getProficiencyBonus", () => {
  it("returns 2 for CR 0-4", () => {
    expect(getProficiencyBonus("0")).toBe(2);
    expect(getProficiencyBonus("4")).toBe(2);
  });
  it("returns 3 for CR 5-8", () => {
    expect(getProficiencyBonus("5")).toBe(3);
    expect(getProficiencyBonus("8")).toBe(3);
  });
  it("returns 6 for CR 17-20", () => {
    expect(getProficiencyBonus("17")).toBe(6);
    expect(getProficiencyBonus("20")).toBe(6);
  });
  it("handles fractional CRs", () => {
    expect(getProficiencyBonus("1/4")).toBe(2);
    expect(getProficiencyBonus("1/2")).toBe(2);
  });
});

describe("parseCR", () => {
  it("parses integer CRs", () => {
    expect(parseCR("5")).toBe(5);
  });
  it("parses fractional CRs", () => {
    expect(parseCR("1/4")).toBe(0.25);
    expect(parseCR("1/2")).toBe(0.5);
  });
  it("returns 0 for empty string", () => {
    expect(parseCR("")).toBe(0);
  });
});

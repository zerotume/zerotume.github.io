// film.js — the scene order. Each scene is an independent module with {duration, cues, render(ctx,t)}.
// Global time = sum of previous scene durations (scenes own their transitions at their edges).
export const SCENES = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];

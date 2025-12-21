/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * * @template T - The type of elements in the array.
 * @param array - The array to be shuffled.
 * @returns The same array instance, now shuffled.
 *
 * @source https://stackoverflow.com/questions/48083353/i-want-to-know-how-to-shuffle-an-array-in-typescript
 * @author Posted by Sergii Rudenko, modified by community. See post 'Timeline' for change history, retrieved 2025-12-18
 * @license CC BY-SA 4.0
 */
export function shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length,  randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
  
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
}

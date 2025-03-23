
export function formatMarkdownDescription(input: string, leadingSpacesToRemove?: number): string {
  if (leadingSpacesToRemove === undefined) {
    leadingSpacesToRemove = input.split('\n').reduce((acc, line) => {
      if (line.trim().length === 0) {
        return acc;
      }
      const leadingSpaces = line.match(/^ +/);
      if (leadingSpaces) {
        return Math.min(acc, leadingSpaces[0].length);
      }
      return acc;
    }, Infinity);
  }
  return input.trim().replace(new RegExp(`^ {${leadingSpacesToRemove}}`, 'gm'), '');
}
export function chooseWorkspace<T extends { id: string }>(options: T[], selectedId: string) {
  return options.find((option) => option.id === selectedId) || options[0];
}

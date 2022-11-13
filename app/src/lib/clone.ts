export function cloneKeys(ob: any) {
  const end = {}
  for (const key in ob) {
    if (ob[key] instanceof Object) end[key] = cloneKeys(ob[key])
    else end[key] = ob[key]
  }
  return end
}
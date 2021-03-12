import { DataBase, Data } from "josm"

type Key = string | number
type GenericValType = string | number | boolean
type GenericObjectType = {[key in Key]: GenericValType | GenericObjectType}
type Name = string

declare let settings: {[key in string]: any}
//@ts-ignore
window.settings = {}




export function constructLocalSettings<T extends GenericValType | GenericObjectType>(db: { write: (() => Promise<void> | void), read: () => T }) {
  //@ts-ignore
  function createLocalSettings(settingsName: Name, settingsDefault_valDefault: T): T extends GenericValType ? Data<T> : DataBase<T> {
    let dat: any
  
    let val: any
    try {
      val = JSON.parse(localStorage[settingsName])
    }
    catch(e) {}
  
    if (typeof settingsDefault_valDefault === "object" && settingsDefault_valDefault !== null) {
      if (typeof val !== "object") val = undefined
      dat = new DataBase(val, settingsDefault_valDefault as any)
      dat((v: any) => {
        localStorage[settingsName] = JSON.stringify(v)
      }, false)
    }
    else {
      dat = new Data(val, settingsDefault_valDefault)
      dat.get((v) => {
        localStorage[settingsName] = JSON.stringify(v)
      }, false)
    }
    return settings[settingsName] =  dat
  }

  return createLocalSettings
}

export default constructLocalSettings


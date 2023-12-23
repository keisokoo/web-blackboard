import Konva from "konva";
import generateHash from "../helper/generateHash";
import { PaintType } from "./types";

type UserType = 'local' | 'remote'

type WBLineConfig = {
  userId: string
  userType: UserType
  lineConfig: Konva.LineConfig
  deleteAble?: boolean
}

class WBLine {
  userId: string
  line: Konva.Line
  type: PaintType = 'pen'
  timestamp: {
    start: number
    end: number
  } = {
    start: Date.now(),
    end: Date.now()
  }
  config: WBLineConfig
  constructor(config: WBLineConfig) {
    this.config = config
    this.userId = config.userId
    this.line = new Konva.Line({
      id: config.userType + '-' + config.userId + '-' + generateHash(),
      ...config.lineConfig
    })
  }
  setTimestamp(timestamp: {
    start?: number
    end?: number
  }) {
    this.timestamp = {
      ...this.timestamp,
      ...timestamp
    }
  }
  getLine() {
    return this.line
  }
  getPoints() {
    return this.line.points()
  }
}
export default WBLine;
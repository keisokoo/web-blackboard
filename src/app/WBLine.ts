import Konva from "konva";
import generateHash from "../helper/generateHash";

type UserType = 'local' | 'remote'

type WBLineConfig = {
  userId: string
  userType: UserType
  lineConfig: Konva.LineConfig
  points: number[]
}

class WBLine {
  id: string
  line: Konva.Line
  config: WBLineConfig
  constructor(config: WBLineConfig) {
    this.config = config
    this.id = config.userType + '-' + config.userId + '-' + generateHash()
    this.line = new Konva.Line({
      id: this.id,
      ...config.lineConfig
    })
  }
  getLine() {
    return this.line
  }
  getPoints() {
    return this.line.points()
  }
}
export default WBLine;
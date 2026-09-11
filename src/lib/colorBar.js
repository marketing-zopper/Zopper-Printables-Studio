// 22-patch representative colour control strip (visual approximation, not a
// measured/certified control strip).
const solid = (r, g, b) => ({ r, g, b })

export const COLOR_BAR_PATCHES = [
  solid(0, 174, 239), // C 100
  solid(102, 204, 244), // C 75
  solid(153, 220, 247), // C 50
  solid(204, 237, 251), // C 25
  solid(236, 0, 140), // M 100
  solid(240, 102, 178), // M 75
  solid(245, 153, 202), // M 50
  solid(250, 204, 227), // M 25
  solid(255, 242, 0), // Y 100
  solid(255, 245, 102), // Y 75
  solid(255, 248, 153), // Y 50
  solid(255, 252, 204), // Y 25
  solid(35, 31, 32), // K 100
  solid(88, 89, 91), // K 75
  solid(147, 149, 152), // K 50
  solid(200, 201, 199), // K 25
  solid(46, 49, 146), // C+M (blue)
  solid(0, 166, 81), // C+Y (green)
  solid(237, 28, 36), // M+Y (red)
  solid(35, 24, 21), // C+M+Y (rich black)
  solid(255, 255, 255), // paper white
  solid(0, 0, 0), // registration black
]

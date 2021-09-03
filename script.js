
/**
 * HAZARDOUS SHOOTDOWN
 * Copyright 2021, Kaden Campbell, All rights reserved.
 */

new p5()

// color palette
const colors = {
  blue: color(0, 180, 225),
  black: color(85, 85, 85),
  red: color(240, 80, 85),
  green: color(0, 225, 110),
  purple: color(191, 127, 245),
  yellow: color(253, 231, 113),
  orange: color(240, 140, 85),
  gray: color(150, 150, 150),
  indigo: color(118, 141, 252),
}

// turret settings
const turret = {
  speed: 0, // movement speed (pixels per frame)
  rot_speed: 4, // rotation speed (degrees per frame)
  spread: 8, // angle of spread (degrees)
  fire_rate: 10, // delay between shots (frames)
  hp: 10, // health points (damage required to destroy it)
}

// projectile settings
const projectile = {
  rad: 10, // radius (pixels)
  speed: 6, // movement speed (pixels per frame)
  strength: 1, // damage dealt upon collision
  hp: 10, // health points (damage required to destroy it)
}

// hazard settings
const hazard = [
  { // SOLDIER ("default" red hazard)
    rad: 14,           // radius (pixels)
    speed: 2,          // movement speed (pixels per frame)
    strength: 2,       // damage dealt upon collision
    hp: 4,             // health points (damage required to destroy it)
    color: colors.red, // color
    evasive: false     // evasive? (attempts to evade projectiles)
  },
  { // SCOUT ("quick" yellow hazard)
    rad: 10,
    speed: 10,
    strength: 2,
    hp: 2,
    color: colors.yellow,
    evasive: true,
  },
  { // EVASIVE ("dodgy" orange hazard)
    rad: 18,
    speed: 4,
    strength: 4,
    hp: 6,
    color: colors.orange,
    evasive: true,
  },
  { // MOTHERSHIP ("large reproducing" purple hazard)
    rad: 30,
    speed: 0.4,
    strength: 6,
    hp: 40,
    color: colors.purple,
    evasive: false,
  },
  { // BOSS ("very large reproducing" indigo hazard)
    rad: 45,
    speed: 0.2,
    strength: 10,
    hp: 120,
    color: colors.indigo,
    evasive: false
  },
]

/** TODO
 * 1. add turret movement with WASD
 * 2. rework difficulty system
 * 3. add camera system
 * 4. add map borders
 */

/** SCORE
 * destroying hazards increases score (points)
 * different hazard types reward different point values
 * 
 * TYPE        REWARD
 * soldier     4 points
 * scout       2 points
 * evasive     6 points
 * mothership  40 points
 * boss        120 points
 * drone       2 points (small hazards from mothership/boss)
 */
let score = 0

/** DIFFICULTY
 * delay in frames between hazard spawns
 * destroying a hazard decreases this delay by 1 frame
 * minimum delay is 30 frames
 */
let difficulty = 180

let hazards = []
let turrets = []
let projectiles = []

class Turret {
  constructor(x, y, speed, rot_speed, spread, fire_rate, hp) {
    this.pos = { x: x, y: y }      // position
    this.vel = { x: 0, y: 0 }      // velocity
    this.speed = speed             // movement speed
    this.rot_speed = rot_speed     // rotation speed
    this.spread = spread           // spread
    this.fire_rate = fire_rate     // rate of projectile fire (delay in frames between each shot)
    this.hp = hp                   // health points
    this.max_hp = hp               // maximum health points
    this.hp_display = hp           // health point display (helps smoothly animate health bar)
    this.recoil = 0                // recoil (used to create a "knockback" effect when firing)
    this.opacity = 0               // opacity
    this.hurt_opacity = 0          // hurt indicator opacity (red "flash" when damaged)
    this.hp_bar_opacity = 0        // health bar opacity
    this.scale = 0                 // scale
    this.rot = 270                 // rotation
    this.hazard_timer = difficulty // hazard spawning timer
    this.projectile_timer = 0      // projectile firing timer
    this.live = true               // is live? (is the turret still alive?)
  }
  draw() {
    // set opacity
    colors.black.setAlpha(this.opacity)
    colors.gray.setAlpha(this.opacity)
    colors.blue.setAlpha(this.opacity)
    colors.red.setAlpha(this.hurt_opacity)

    push()
    translate(this.pos.x, this.pos.y)
    scale(this.scale)
    rotate(this.rot)
    translate(-this.recoil - 10, 0)

    // barrel outline
    stroke(colors.black)
    noFill()
    rect(0, -10, 50, 20)

    // barrel
    noStroke()
    fill(colors.gray)
    rect(2, -8, 46, 16)

    // barrel hurt indicator  (red "flash" when damaged)
    fill(colors.red)
    rect(-2, -12, 54, 24)

    // hexagonal body outline
    rotate(-this.rot)
    noFill()
    stroke(colors.black)
    hexagon(0, 0, 30)

    // hexagonal body
    noStroke()
    fill(colors.blue)
    hexagon(0, 0, 30 - 2.3)

    // hexagonal body hurt indicator
    fill(colors.red)
    hexagon(0, 0, 30 + 2.3)

    // score
    fill(colors.black)
    textSize(60 * pow(0.75, score.toString().length))
    text(score, 0, -5 + score.toString().length / 2)

    // set health bar opacity
    colors.black.setAlpha(this.hp_bar_opacity)
    colors.green.setAlpha(this.hp_bar_opacity)

    // health bar
    rotate(this.rot)
    translate(this.recoil, 0)
    rotate(-this.rot)
    noStroke()
    fill(colors.black)
    rect(-30, 40, 60, 9, 4.5)
    fill(colors.green)
    rect(-27, 43, this.hp_display / this.max_hp * 54, 3, 1.5)

    pop()
  }
  animate(i) {
    // spawn animation
    if (this.scale < 1) this.scale += 0.1
    if (this.opacity < 255 && this.live) this.opacity += 30

    // slowly regeneration health points over time
    if (this.live) this.hp += 0.005

    // constrain health points between 0 and max health points
    this.hp = constrain(this.hp, 0, this.max_hp)

    // "smoothly" update health point display to match health point value
    this.hp_display += (this.hp - this.hp_display) / 10

    // mark turret not "live" once health points have depleted
    if (this.hp == 0) this.live = false

    // death animation
    if (!this.live) {
      this.scale += 0.05
      this.opacity -= 30
      this.hurt_opacity -= 60
      this.hp_bar_opacity -= 60
      if (this.opacity <= 0) turrets.splice(i, 1)
    }

    // hide and show health bar
    if (this.hp == this.max_hp) this.hp_bar_opacity -= 30
    else this.hp_bar_opacity += 30

    // constrain health bar opacity between 0 and 255
    this.hp_bar_opacity = constrain(this.hp_bar_opacity, 0, 255)

    // rotate turret to mouse
    let a1 = atan2(mouseY - this.pos.y, mouseX - this.pos.x)
    let a2 = atan2(sin(this.rot), cos(this.rot))
    if (abs(a2 - a1) <= this.rot_speed) {
      this.rot = a1
    } else {
      var a = (a1 - a2)
      a += a < 0 ? 360 : a >= 360 ? -360 : 0
      this.rot += a < 180 ? this.rot_speed : -this.rot_speed
      this.rot += this.rot < 0 ? 360 : this.rot >= 360 ? -360 : 0
    }

    // hurt indicator animation (red "flash" when damaged)
    if (this.hurt_opacity > 0) this.hurt_opacity -= 30

    // recoil animation
    if (this.recoil > 0) this.recoil--
  }
  collide() {
    hazards.forEach(h => {
      let d = dist(h.pos.x, h.pos.y, this.pos.x, this.pos.y) // distance between hazard and turret
      if (d <= 30 + h.rad + 8 && this.live && h.live) {
        // apply damage
        this.hp -= h.hp / h.max_hp * h.strength
        h.hp = 0

        // show hurt indicator
        h.hurt_opacity = 255
        this.hurt_opacity = 255
      }
    })
  }
  spawnProjectiles() {
    if (mouseIsPressed && this.live) {
      // fire projectile when timer depletes
      if (this.projectile_timer == 0) {
        // apply recoil to turret
        this.recoil = 5
        let x = this.pos.x + cos(this.rot) * (15 + projectile.rad / 2), // x position
          y = this.pos.y + sin(this.rot) * (15 + projectile.rad / 2),   // y position
          slope = this.rot + random(-this.spread / 2, this.spread / 2)  // slope
        projectiles.push(new Projectile(x, y, slope, projectile.rad, projectile.speed, projectile.strength, projectile.hp))
        // reset timer to turret fire rate
        this.projectile_timer = this.fire_rate
      }
    }
    // decrement timer
    if (this.projectile_timer > 0) this.projectile_timer--
  }
  spawnHazards() {
    // spawn hazard when timer depletes
    if (this.hazard_timer <= 0) {
      let a = random(360),                       // spawn position angle
        x = windowWidth / 2 + cos(a) * 500,      // x position
        y = windowHeight / 2 + sin(a) * 500,     // y position
        s = slope(x, y, this.pos.x, this.pos.y), // slope
        t = 0,                                   // hazard type
        v = { x: 0, y: 0 }                       // velocity
      // roll to "upgrade" hazard
      // 1 in 3 chance of success
      // if success, roll again
      while (t < hazard.length - 1) {
        if (floor(random(3)) == 0) t++
        else break
      }
      hazards.push(new Hazard(x, y, s, v, hazard[t].rad, hazard[t].speed, hazard[t].strength, hazard[t].hp, hazard[t].color, hazard[t].evasive))
      // reset timer to current difficulty value
      this.hazard_timer = difficulty
    }
    // decrement timer
    this.hazard_timer--
  }
}

class Hazard {
  constructor(x, y, slope, vel, rad, speed, strength, hp, color, evasive) {
    this.pos = { x: x, y: y }    // position
    this.vel = vel               // velocity
    this.rad = rad               // radius (decreases slightly when damaged)
    this.max_rad = rad           // maximum radius
    this.speed = speed           // movement speed
    this.strength = strength     // strength (damage dealt upon collision)
    this.max_hp = hp             // maximum health points
    this.color = color           // color
    this.hp = hp                 // health points
    this.hp_display = hp         // health points display (helps smoothly animate health bar)
    this.rot = 0                 // rotation
    this.live = true             // is live? (is the hazard still alive?) 
    this.opacity = 0             // opacity
    this.hurt_opacity = 0        // hurt indicator opacity (red "flash" when damaged)
    this.hp_bar_opacity = 0      // health bar opacity
    this.scale = 0               // scale
    this.time_to_live = rad * 72 // time to live
    this.hazard_timer = 120      // hazard spawning timer
    this.slope = slope           // slope
    this.evasive = evasive       // is evasive? (does the hazard attempt to evade projectiles?)
  }
  draw() {
    // set opacity
    colors.black.setAlpha(this.opacity)
    this.color.setAlpha(this.opacity)

    push()
    translate(this.pos.x, this.pos.y)
    scale(this.scale)
    push()
    rotate(this.rot + this.slope)

    // burst (spiky shape) outline
    noFill()
    stroke(colors.black)
    burst(0, 0, this.rad)

    // burst
    fill(this.color)
    noStroke()
    burst(0, 0, this.rad - 3)

    // set hurt indicator opacity
    colors.red.setAlpha(this.hurt_opacity)

    // hurt indicator (red "flash" when damaged)
    fill(colors.red)
    burst(0, 0, this.rad + 3)
    pop()
    noStroke()

    // set health bar opacity
    colors.black.setAlpha(this.hp_bar_opacity)
    colors.green.setAlpha(this.hp_bar_opacity)

    // health bar
    fill(colors.black)
    rect(-this.rad - 3, this.rad * 1.1 + 10, this.rad * 2 + 6, 9, 4.5)
    fill(colors.green)
    rect(-this.rad, this.rad * 1.1 + 13, this.hp_display / this.max_hp * (this.rad * 2), 3, 3)
    pop()
  }
  animate(i) {
    // find nearest turret within range (to attack)
    let min_d, target;
    turrets.forEach((t, j) => {
      let d = dist(t.pos.x, t.pos.y, this.pos.x, this.pos.y)
      if (d <= 800 && (d < min_d || !min_d)) {
        min_d = d
        target = j
      }
    })
    // if a turret within range exists, attack the nearest one
    if (typeof target !== 'undefined') {
      this.slope = slope(this.pos.x, this.pos.y, turrets[target].pos.x, turrets[target].pos.y)
      this.vel.x += (cos(this.slope) * this.speed - this.vel.x) / 25
      this.vel.y += (sin(this.slope) * this.speed - this.vel.y) / 25
    }
    // otherwise drift around slowly
    else {
      this.vel.x += (cos(this.slope) * this.speed / 5 - this.vel.x) / 50
      this.vel.y += (sin(this.slope) * this.speed / 5 - this.vel.y) / 50
      this.time_to_live -= 10; // rapidly decremenet time to live
    }

    // spawn animation
    if (this.scale < 1) this.scale += 0.1
    if (this.opacity < 255 && this.live) this.opacity += 30

    // hide and show health bar
    if (this.hp < this.max_hp && this.live) this.hp_bar_opacity += 60
    if (this.hp == this.max_hp && this.live) this.hp_bar_opacity -= 60

    // constrain health bar opacity between 0 and 255
    this.hp_bar_opacity = constrain(this.hp_bar_opacity, 0, 255)

    // constrain health points within 0 and max health points
    this.hp = constrain(this.hp, 0, this.max_hp)

    // "smoothly" update health point display to match health point value
    this.hp_display += (this.hp - this.hp_display) / 5

    // animate hurt indicator (red "flash" when damaged)
    this.hurt_opacity -= 30

    // death animation
    if (!this.live) {
      this.scale += 0.05 // "popping" effect
      this.opacity -= 30
      this.hp_bar_opacity -= 30
      if (this.opacity <= 0) {
        // increase difficulty
        if (difficulty > 30) {
          difficulty--
        }
        // increase score
        if (turrets.length) score += ceil(this.max_hp)
        // delete hazard from array
        hazards.splice(i, 1)
      }
    }

    // decrement time to live
    this.time_to_live--

    // mark hazard not "live" once health points or time to live has depleted
    if (this.hp <= 0 || this.time_to_live <= 0) {
      this.live = false
    }

    // update position based on velocity
    this.pos.x += this.vel.x
    this.pos.y += this.vel.y

    // rotate hazard based on net velocity ("spinning" effect)
    this.rot += (abs(this.vel.x) + abs(this.vel.y))

    // decrease radius as health points deplete ("shrinking" effect)
    this.rad = (this.hp / this.max_hp * 0.25 + 0.75) * this.max_rad;
  }
  collide(i) {
    hazards.forEach((h, j) => {
      let d = dist(h.pos.x, h.pos.y, this.pos.x, this.pos.y) // distance between hazards
      if (d <= h.rad + this.rad + 8 && this.live && h.live && i != j) {
        let o = h.rad + this.rad + 8 - d, // overlap between projectile and hazard

          s1 = slope(this.pos.x, this.pos.y, h.pos.x, h.pos.y), // slope of projectile
          s2 = slope(h.pos.x, h.pos.y, this.pos.x, this.pos.y), // slope of hazard

          r1 = pow(this.rad, 3) / (pow(this.rad, 3) + pow(h.rad, 3)), // size ratio of projectile
          r2 = pow(h.rad, 3) / (pow(this.rad, 3) + pow(h.rad, 3)),    // size ratio of hazard

          v1 = sqrt(sq(this.vel.x) + sq(this.vel.y)), // velocity of projectile
          v2 = sqrt(sq(h.vel.x) + sq(h.vel.y))        // velocity of hazard

        // redirect after collision
        h.vel.x = cos(s1) * (v1 + v2) * r1
        h.vel.y = sin(s1) * (v1 + v2) * r1
        this.vel.x = cos(s2) * (v1 + v2) * r2
        this.vel.y = sin(s2) * (v1 + v2) * r2

        // prevent projectile and hazard from overlapping
        h.pos.x += cos(s1) * o * r1
        h.pos.y += sin(s1) * o * r1
        this.pos.x += cos(s2) * o * r2
        this.pos.y += sin(s2) * o * r2
      }
    })
  }
  spawnHazards() {
    if (this.max_rad >= 30) {
      if (this.hazard_timer == 0) {
        let a = random(360),                         // spawn position angle
          x = this.pos.x + cos(a) * (this.rad + 12), // x position
          y = this.pos.y + sin(a) * (this.rad + 12), // y position
          s = slope(this.pos.x, this.pos.y, x, y),   // slope
          v = {
            x: cos(s) * 8,                           // x velocity
            y: sin(s) * 8,                           // y velocity
          }
        hazards.push(new Hazard(x, y, s, v, 8, 6, 0.25, 2, this.color))
        // reset hazard spawn timer
        this.hazard_timer = round(81000 / sq(this.max_rad))
      }
      else if (this.hazard_timer > 0) this.hazard_timer-- // decrement hazard spawn timer
    }
  }
  evade() {
    if (this.evasive) {
      projectiles.forEach(p => {
        let d = dist(p.pos.x, p.pos.y, this.pos.x, this.pos.y) // distance between projectile and hazard
        // check if projectile is near hazard
        if (d <= (p.rad + this.rad + 8) * 2 && this.live && p.live) {
          // slope from projectile to hazard
          let s = slope(p.pos.x, p.pos.y, this.pos.x, this.pos.y)
          
          // move hazard away from projectile
          this.vel.x += cos(s)
          this.vel.y += sin(s)
        }
      })
    }
  }
}

class Projectile {
  constructor(x, y, slope, rad, speed, strength, hp) {
    this.pos = { x: x, y: y } // position
    this.vel = {
      x: cos(slope) * speed,  // x velocity
      y: sin(slope) * speed,  // y velocity
    }
    this.max_rad = rad        // maximum radius
    this.rad = rad            // radius
    this.speed = speed        // movement speed 
    this.strength = strength  // strength (damage dealt upon collision)
    this.max_hp = hp          // maximum health points
    this.hp = hp              // health points
    this.slope = slope        // slope (direction of travel)
    this.rot = 0              // rotation
    this.live = true          // is live? (is the projectile still alive?)
    this.opacity = 0          // opacity
    this.hurt_opacity = 0     // hurt indicator opacity (red "flash" when damaged)
    this.time_to_live = 300   // time to live
    this.scale = 0            // scale
  }
  draw() {
    // set opacity
    colors.black.setAlpha(this.opacity)
    colors.blue.setAlpha(this.opacity)
    colors.red.setAlpha(this.hurt_opacity)

    push()
    translate(this.pos.x, this.pos.y)
    rotate(this.slope + this.rot)
    scale(this.scale)

    // hexagon body outline
    noFill()
    stroke(colors.black)
    hexagon(0, 0, this.rad)
    
    // hexagonal body
    fill(colors.blue)
    noStroke()
    hexagon(0, 0, this.rad - 2.3)

    // hurt indicator (red "flash" when damaged)
    fill(colors.red)
    hexagon(0, 0, this.rad + 2.3)
    pop()
  }
  animate(i) {
    // spawn animation
    if (this.scale < 1) this.scale += 0.1
    if (this.opacity < 255 && this.live) this.opacity += 30

    // hurt indicator animation (red "flash" when damaged)
    this.hurt_opacity -= 30

    // decrement time to live 
    this.time_to_live--

    // mark projectile as not live once health or time to live has been depleted
    if (this.time_to_live <= 0 || this.hp <= 0) {
      this.live = false
    }

    // death animation
    if (!this.live) {
      this.scale += 0.05
      this.opacity -= 30
      if (this.opacity <= 0) {
        // delete projectile
        projectiles.splice(i, 1)
      }
    }

    // update position based on velocity
    this.pos.x += this.vel.x
    this.pos.y += this.vel.y
    
    // rotate projectile based on net velocity ("spinning" effect)
    this.rot += (abs(this.vel.x) + abs(this.vel.y))

    // decrase radius when damaged ("shrinking" effect)
    this.rad = (this.hp / this.max_hp * 0.25 + 0.75) * this.max_rad;
  }
  collide() {
    hazards.forEach(h => {
      let d = dist(h.pos.x, h.pos.y, this.pos.x, this.pos.y) // distance between projectile and hazard
      if (d <= h.rad + this.rad + 8 && this.live && h.live) {
        let o = h.rad + this.rad + 8 - d, // overlap between projectile and hazard

          s1 = slope(this.pos.x, this.pos.y, h.pos.x, h.pos.y), // slope of projectile
          s2 = slope(h.pos.x, h.pos.y, this.pos.x, this.pos.y), // slope of hazard

          r1 = pow(this.rad, 3) / (pow(this.rad, 3) + pow(h.rad, 3)), // size ratio of projectile
          r2 = pow(h.rad, 3) / (pow(this.rad, 3) + pow(h.rad, 3)),    // size ratio of hazard

          v1 = sqrt(sq(this.vel.x) + sq(this.vel.y)), // velocity of projectile
          v2 = sqrt(sq(h.vel.x) + sq(h.vel.y))        // velocity of hazard

        // redirect after collision
        h.vel.x = cos(s1) * (v1 + v2) * r1
        h.vel.y = sin(s1) * (v1 + v2) * r1
        this.vel.x = cos(s2) * (v1 + v2) * r2
        this.vel.y = sin(s2) * (v1 + v2) * r2

        // prevent projectile and hazard from overlapping
        h.pos.x += cos(s1) * o * r1
        h.pos.y += sin(s1) * o * r1
        this.pos.x += cos(s2) * o * r2
        this.pos.y += sin(s2) * o * r2

        // show hurt indicator (red "flash" when damaged)
        h.hurt_opacity = 255
        this.hurt_opacity = 255

        // apply damage
        h.hp -= this.strength
        this.hp -= h.strength
      }
    })
  }
}

function outlineText(message, x, y, a) {
  colors.black.setAlpha(a)
  colors.red.setAlpha(a)
  fill(colors.black)
  for (let i = 0; i <= 360; i += 360 / 16) {
    text(message, x + cos(i) * 4, y + sin(i) * 4)
  }
  fill(colors.red)
  text(message, x, y)
}

function hexagon(x, y, rad) {
  beginShape()
  for (let i = 0; i <= 6; i++) {
    vertex(x + sin(i * 60) * rad, y + cos(i * 60) * rad)
  }
  endShape()
}

function burst(x, y, rad) {
  beginShape()
  for (let i = 0; i <= 10; i++) {
    vertex(x + sin(i * 45) * rad * 1.2, y + cos(i * 45) * rad * 1.2)
    vertex(x + sin(22.5 + i * 45) * rad * 0.8, y + cos(22.5 + i * 45) * rad * 0.8)
  }
  endShape()
}

function slope(x, y, x2, y2) {
  return atan2(y2 - y, x2 - x)
}

angleMode(DEGREES)

let roboto_bold
function preload() {
  roboto_bold = loadFont('assets/Roboto-Bold.ttf')
}

function setup() {
  cursor(CROSS)
  frameRate(60)
  createCanvas(windowWidth, windowHeight)
  strokeWeight(4)
  textAlign(CENTER, CENTER)
  textFont(roboto_bold)
}

turrets.push(new Turret(windowWidth / 2, windowHeight / 2, ...Object.values(turret)))

// while (turrets.length < 6) {
//   let x = windowWidth / 2 + cos(turrets.length * 360 / 6) * 100
//   let y = windowHeight / 2 + sin(turrets.length * 360 / 6) * 100
//   turrets.push(new Turret(x, y, ...Object.values(turret)))
// }

function draw() {
  background(230)

  projectiles.forEach((p, i) => {
    p.draw()
    p.collide()
  })

  hazards.forEach((h, i) => {
    h.draw()
    h.collide(i)
    h.spawnHazards()
    h.evade()
  })

  turrets.forEach((t, i) => {
    t.draw()
    t.collide()
    t.spawnHazards()
    t.spawnProjectiles()
  })

  projectiles.forEach((p, i) => { p.animate(i) })
  hazards.forEach((h, i) => { h.animate(i) })
  turrets.forEach((t, i) => { t.animate(i) })

  if (!turrets.length) {
    textSize(100)
    outlineText(score, windowWidth / 2, windowHeight / 2, 255)
  }
}
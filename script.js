/** 
 * HAZARDOUS SHOOTDOWN
 * Copyright 2021, Kaden Campbell, All rights reserved.
 */

new p5();

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
};

// turret settings
const turret = {
  speed: 0, // movement speed (pixels per frame)
  rot_speed: 4, // rotation speed (degrees per frame)
  spread: 8, // angle of spread (degrees)
  fire_rate: 16, // delay between shots (frames)
  hp: 16, // health points (damage required to destroy it)
};

// projectile settings
const projectile = {
  rad: 12, // radius (pixels)
  speed: 6, // movement speed (pixels per frame)
  strength: 1, // damage dealt upon collision
  hp: 2, // health points (damage required to destroy it)
};

// hazard settings
const hazard = [
  {
    color: colors.red,
    rad: 16,
    speed: 2,
    strength: 2,
    hp: 4,
    abilities: [],
    spawn: { weight: 400, modifier: -1 },
  },
  {
    color: colors.yellow,
    rad: 12,
    speed: 6,
    strength: 2,
    hp: 2,
    abilities: ['evasive'],
    spawn: { weight: 160, modifier: -0.6 },
  },
  {
    color: colors.green,
    rad: 20,
    speed: 2,
    strength: 3,
    hp: 8,
    abilities: ['explosive'],
    spawn: { weight: 80, modifier: -0.2 },
  },
  {
    color: colors.orange,
    rad: 24,
    speed: 4,
    strength: 4,
    hp: 12,
    abilities: [],
    spawn: { weight: 40, modifier: 0.2 },
  },
  {
    color: colors.purple,
    rad: 32,
    speed: 0.4,
    strength: 8,
    hp: 24,
    abilities: ['mothership'],
    spawn: { weight: 4, modifier: 0.6 },
  },
  {
    color: colors.indigo,
    rad: 48,
    speed: 0.2,
    strength: 16,
    hp: 48,
    abilities: ['mothership'],
    spawn: { weight: 1, modifier: 1.0 },
  },
];

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
let score = 0;

/** DIFFICULTY
 * delay in frames between hazard spawns
 * destroying a hazard decreases this delay by 1 frame
 * minimum delay is 30 frames
 */
let difficulty = 1.00;

let hazards = [];
let turrets = [];
let projectiles = [];
let clicks = [];

class Turret {
  constructor(pos, speed, rot_speed, spread, fire_rate, hp) {
    this.pos = { x: pos.x, y: pos.y };      // position
    this.vel = { x: 0, y: 0 };      // velocity
    this.speed = speed;             // movement speed
    this.rot_speed = rot_speed;     // rotation speed
    this.spread = spread;           // spread
    this.fire_rate = fire_rate;     // rate of projectile fire (delay in frames between each shot)
    this.hp = hp;                   // health points
    this.max_hp = hp;               // maximum health points
    this.hp_display = hp;           // health point display (helps smoothly animate health bar)
    this.recoil = 0;                // recoil (used to create a "knockback" effect when firing)
    this.opacity = 0;               // opacity
    this.hurt_opacity = 0;          // hurt indicator opacity (red "flash" when damaged)
    this.hp_bar_opacity = 0;        // health bar opacity
    this.scale = 0;                 // scale
    this.rot = 270;                 // rotation
    this.hazard_timer = 0;          // hazard spawning timer
    this.projectile_timer = 0;      // projectile firing timer
    this.live = true;               // is live? (is the turret still alive?)
  }
  draw() {
    // set opacity
    colors.black.setAlpha(this.opacity);
    colors.gray.setAlpha(this.opacity);
    colors.blue.setAlpha(this.opacity);
    colors.red.setAlpha(this.hurt_opacity);

    push();
    translate(this.pos.x, this.pos.y);
    scale(this.scale);
    rotate(this.rot);
    translate(-this.recoil - 10, 0);

    // barrel outline
    stroke(colors.black);
    noFill();
    rect(0, -10, 50, 20);

    // barrel
    noStroke();
    fill(colors.gray);
    rect(2, -8, 46, 16);

    // barrel hurt indicator  (red "flash" when damaged)
    fill(colors.red);
    rect(-2, -12, 54, 24);

    // hexagonal body outline
    rotate(-this.rot);
    noFill();
    stroke(colors.black);
    hexagon(0, 0, 30);

    // hexagonal body
    noStroke();
    fill(colors.blue);
    hexagon(0, 0, 30 - 2.9);

    // hexagonal body hurt indicator
    fill(colors.red);
    hexagon(0, 0, 30 + 2.9);

    // score
    fill(colors.black);
    textSize(60 * pow(0.75, score.toString().length));
    text(score, 0, -5 + score.toString().length / 2);

    // set health bar opacity
    colors.black.setAlpha(this.hp_bar_opacity);
    colors.green.setAlpha(this.hp_bar_opacity);

    // health bar
    rotate(this.rot);
    translate(this.recoil, 0);
    rotate(-this.rot);
    noStroke();
    fill(colors.black);
    rect(-30, 40, 60, 9, 4.5);
    fill(colors.green);
    rect(-27, 43, this.hp_display / this.max_hp * 54, 3, 1.5);

    pop();
  }
  animate(i) {
    // spawn animation
    if (this.scale < 1) this.scale += 0.1;
    if (this.opacity < 255 && this.live) this.opacity += 30;

    // slowly regeneration health points over time
    if (this.live) this.hp += 0.005;

    // constrain health points between 0 and max health points
    this.hp = constrain(this.hp, 0, this.max_hp);

    // "smoothly" update health point display to match health point value
    this.hp_display += (this.hp - this.hp_display) / 4;

    // mark turret not "live" once health points have depleted
    if (this.hp === 0) this.live = false;

    // death animation
    if (!this.live) {
      this.scale += 0.05;
      this.opacity -= 30;
      this.hurt_opacity -= 30;
      this.hp_bar_opacity -= 30;
      if (this.opacity <= 0) turrets.splice(i, 1);
    }

    // hide and show health bar
    if (this.hp == this.max_hp) this.hp_bar_opacity -= 30;
    else this.hp_bar_opacity += 30;

    // constrain health bar opacity between 0 and 255
    this.hp_bar_opacity = constrain(this.hp_bar_opacity, 0, 255);

    // rotate turret to mouse
    let a1 = atan2(mouseY - this.pos.y, mouseX - this.pos.x),
      a2 = atan2(sin(this.rot), cos(this.rot));
    if (abs(a2 - a1) <= this.rot_speed) {
      this.rot = a1;
    } else {
      let a = (a1 - a2);
      a += a < 0 ? 360 : a >= 360 ? -360 : 0;
      this.rot += a < 180 ? this.rot_speed : -this.rot_speed;
      this.rot += this.rot < 0 ? 360 : this.rot >= 360 ? -360 : 0;
    }

    // hurt indicator animation (red "flash" when damaged)
    this.hurt_opacity -= 10;

    // recoil animation
    if (this.recoil > 0) this.recoil--;
  }
  collide() {
    hazards.forEach(h => {
      let d = dist(h.pos.x, h.pos.y, this.pos.x, this.pos.y) // distance between hazard and turret
      if (d <= 30 + h.rad + 8 && this.live && h.live) {
        // apply damage
        this.hp -= h.hp / h.max_hp * h.strength;
        h.hp = 0;

        // show hurt indicator
        h.hurt_opacity = 255;
        this.hurt_opacity = 255;
      }
    });
  }
  spawnProjectiles() {
    if (mouseIsPressed && this.live) {
      // fire projectile when timer depletes
      if (this.projectile_timer == 0) {
        // apply recoil to turret
        this.recoil = 5;
        let pos = {
          x: this.pos.x + cos(this.rot) * (15 + projectile.rad / 2), // x position
          y: this.pos.y + sin(this.rot) * (15 + projectile.rad / 2), // y position
        },
          slope = this.rot + random(-this.spread / 2, this.spread / 2); // slope
        projectiles.push(new Projectile(pos, slope, projectile.rad, projectile.speed, projectile.strength, projectile.hp));
        // reset timer to turret fire rate
        this.projectile_timer = this.fire_rate;
      }
    }
    // decrement timer
    if (this.projectile_timer > 0) this.projectile_timer--;
  }
  spawnHazards() {
    // spawn hazard when timer depletes
    if (this.hazard_timer <= 0) {
      let angle = random(360),
        pos = {
          x: windowWidth / 2 + cos(angle) * 500,
          y: windowHeight / 2 + sin(angle) * 500,
        },
        s = slope(pos.x, pos.y, this.pos.x, this.pos.y),
        vel = { x: 0, y: 0 };

      // determine total weight of all hazard types
      let modified_weight = [], total = 0;
      hazard.forEach((h, i) => {
        modified_weight[i] = h.spawn.weight * pow(difficulty, h.spawn.modifier);
        total += modified_weight[i];
      });

      // determine hazard type
      let r = random(total), type;
      hazard.forEach((h, i) => {
        if (typeof type === 'undefined' && r < modified_weight[i]) type = i;
        else r -= modified_weight[i];
      });

      hazards.push(new Hazard(pos, s, vel, ...Object.values(hazard[type])));
      // reset timer to current difficulty value
      this.hazard_timer = 240 / sqrt(difficulty);
    }
    // decrement timer
    this.hazard_timer--;
  }
}

class Hazard {
  constructor(pos, slope, vel, color, rad, speed, strength, hp, abilities, spawn, collision_id) {
    this.pos = { x: pos.x, y: pos.y };
    this.vel = vel;
    this.rad = rad;
    this.max_rad = rad;
    this.speed = speed;
    this.strength = strength;
    this.max_hp = hp;
    this.color = color;
    this.hp = hp;
    this.hp_display = hp;
    this.rot = 0;
    this.live = true;
    this.opacity = 0;
    this.hurt_opacity = 0;
    this.hp_bar_opacity = 0;
    this.scale = 0;
    this.time_to_live = rad * 144;
    this.hazard_timer = 0;
    this.slope = slope;
    this.abilities = {
      evasive: abilities.includes('evasive'),
      explosive: abilities.includes('explosive'),
      mothership: abilities.includes('mothership'),
    };
    this.collision_id = collision_id;
    if (typeof this.collision_id === 'undefined') this.collision_id = hazards.length - 1;
  }
  draw() {
    // set opacity
    colors.black.setAlpha(this.opacity);
    this.color.setAlpha(this.opacity);

    push();
    translate(this.pos.x, this.pos.y);
    scale(this.scale);
    push();
    rotate(this.rot + this.slope);

    // burst (spiky shape) outline
    noFill();
    stroke(colors.black);
    burst(0, 0, this.rad);

    // burst
    fill(this.color);
    noStroke();
    burst(0, 0, this.rad - 3.6);

    // set hurt indicator opacity
    colors.red.setAlpha(this.hurt_opacity);

    // hurt indicator (red "flash" when damaged)
    fill(colors.red);
    burst(0, 0, this.rad + 3.6);
    pop();
    noStroke();

    // set health bar opacity
    colors.black.setAlpha(this.hp_bar_opacity);
    colors.green.setAlpha(this.hp_bar_opacity);

    // health bar
    fill(colors.black);
    rect(-this.rad - 3, this.rad * 1.1 + 10, this.rad * 2 + 6, 9, 4.5);
    fill(colors.green);
    rect(-this.rad, this.rad * 1.1 + 13, this.hp_display / this.max_hp * (this.rad * 2), 3, 3);
    pop()
  }
  animate(i) {
    // find nearest turret within range (to attack)
    let min_d, target;
    turrets.forEach((t, j) => {
      let d = dist(t.pos.x, t.pos.y, this.pos.x, this.pos.y);
      if (d <= 1000 && (d < min_d || !min_d)) {
        min_d = d;
        target = j;
      }
    });

    // if a turret within range exists, become "aggro" (aggravated)
    this.aggro = typeof target !== 'undefined';

    if (this.aggro) {
      // attack nearest turret within range
      this.slope = slope(this.pos.x, this.pos.y, turrets[target].pos.x, turrets[target].pos.y);
      this.vel.x += (cos(this.slope) * this.speed - this.vel.x) / 32;
      this.vel.y += (sin(this.slope) * this.speed - this.vel.y) / 32;

      // decrement time to live
      this.time_to_live--;
    }
    else {
      // otherwise drift around idly
      this.vel.x += (cos(this.slope) * this.speed / 4 - this.vel.x) / 64;
      this.vel.y += (sin(this.slope) * this.speed / 4 - this.vel.y) / 64;

      // rapidly decremenet time to live
      this.time_to_live -= 30;
    }

    // spawn animation
    if (this.scale < 1) this.scale += 0.1;
    if (this.opacity < 255 && this.live) this.opacity += 30;

    // hide and show health bar
    if (this.hp < this.max_hp && this.live) this.hp_bar_opacity += 60;
    if (this.hp == this.max_hp && this.live) this.hp_bar_opacity -= 60;

    // constrain health bar opacity between 0 and 255
    this.hp_bar_opacity = constrain(this.hp_bar_opacity, 0, 255);

    // constrain health points within 0 and max health points
    this.hp = constrain(this.hp, 0, this.max_hp);

    // "smoothly" update health point display to match health point value
    this.hp_display += (this.hp - this.hp_display) / 4;

    // animate hurt indicator (red "flash" when damaged)
    this.hurt_opacity -= 10;

    // death animation
    if (!this.live) {
      if (this.abilities.explosive && this.max_rad >= 20 && this.aggro && this.opacity >= 255) {
        for (let i = 0; i < 3; i++) {
          let angle = i * 360 / 3,
            pos = {
              x: this.pos.x + cos(angle) * (this.rad + 12),
              y: this.pos.y + sin(angle) * (this.rad + 12),
            },
            vel = {
              x: cos(angle) * 8,
              y: sin(angle) * 8,
            },
            rad = this.max_rad / 2;
          hazards.push(new Hazard(pos, angle, vel, this.color, rad, 6, 1, 3, ['explosive'], undefined, this.collision_id));
        }
      }
      this.scale += 0.04; // "popping" effect
      this.hurt_opacity -= 20;
      this.opacity -= 20;
      this.hp_bar_opacity -= 20;
      if (this.opacity <= 0) {
        // increase score
        if (turrets.length) score += floor(this.max_hp * difficulty);
        // delete hazard from array
        hazards.splice(i, 1);
      }
    }

    // mark hazard not "live" once health points or time to live has depleted
    if (this.hp <= 0 || this.time_to_live <= 0) {
      this.live = false;
    }

    // update position based on velocity
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

    // rotate hazard based on net velocity ("spinning" effect)
    this.rot += (abs(this.vel.x) + abs(this.vel.y));

    // decrease radius as health points deplete ("shrinking" effect)
    this.rad = (this.hp / this.max_hp * 0.3 + 0.7) * this.max_rad;
  }
  collide(i) {
    hazards.forEach((h, j) => {
      let d = dist(h.pos.x, h.pos.y, this.pos.x, this.pos.y) // distance between hazards
      if (d <= h.rad + this.rad + 8 && this.live && h.live && i !== j && this.collision_id !== h.collision_id) {
        let o = h.rad + this.rad + 8 - d, // overlap between projectile and hazard

          s1 = slope(this.pos.x, this.pos.y, h.pos.x, h.pos.y), // slope of projectile
          s2 = slope(h.pos.x, h.pos.y, this.pos.x, this.pos.y), // slope of hazard

          r1 = pow(this.rad, 3) / (pow(this.rad, 3) + pow(h.rad, 3)), // size ratio of projectile
          r2 = pow(h.rad, 3) / (pow(this.rad, 3) + pow(h.rad, 3)),    // size ratio of hazard

          v1 = sqrt(sq(this.vel.x) + sq(this.vel.y)), // velocity of projectile
          v2 = sqrt(sq(h.vel.x) + sq(h.vel.y));       // velocity of hazard

        // redirect after collision
        h.vel.x = cos(s1) * (v1 + v2) * r1;
        h.vel.y = sin(s1) * (v1 + v2) * r1;
        this.vel.x = cos(s2) * (v1 + v2) * r2;
        this.vel.y = sin(s2) * (v1 + v2) * r2;

        // prevent projectile and hazard from overlapping
        h.pos.x += cos(s1) * o * r1;
        h.pos.y += sin(s1) * o * r1;
        this.pos.x += cos(s2) * o * r2;
        this.pos.y += sin(s2) * o * r2;
      }
    });
  }
  spawnHazards(i) {
    if (this.abilities.mothership && this.aggro) {
      if (this.hazard_timer == 0) {
        let angle = random(360),
          pos = {
            x: this.pos.x + cos(angle) * (this.rad + 12),
            y: this.pos.y + sin(angle) * (this.rad + 12),
          },
          rad = this.max_rad / 8 + 5,
          strength = this.max_rad / 64,
          hp = this.max_rad / 16,
          vel = {
            x: cos(angle) * 8,
            y: sin(angle) * 8,
          };
        hazards.push(new Hazard(pos, angle, vel, this.color, rad, 6, strength, hp, [], undefined, this.collision_id));
        // reset hazard spawn timer
        this.hazard_timer = floor(3200 / this.rad);
      }
      else if (this.hazard_timer > 0) this.hazard_timer--; // decrement hazard spawn timer
    }
  }
  evade() {
    if (this.abilities.evasive) {
      projectiles.forEach(p => {
        let d = dist(p.pos.x, p.pos.y, this.pos.x, this.pos.y); // distance between projectile and hazard
        // check if projectile is near hazard
        if (d <= (p.rad + this.rad + 10) * 2 && this.live && p.live) {
          // slope from projectile to hazard
          let s = slope(p.pos.x, p.pos.y, this.pos.x, this.pos.y);

          // move hazard away from projectile
          this.vel.x += cos(s) * this.speed / 6;
          this.vel.y += sin(s) * this.speed / 6;
        }
      });
    }
  }
}

class Projectile {
  constructor(pos, slope, rad, speed, strength, hp) {
    this.pos = { x: pos.x, y: pos.y }; // position
    this.vel = {
      x: cos(slope) * speed,   // x velocity
      y: sin(slope) * speed,   // y velocity
    };
    this.max_rad = rad;        // maximum radius
    this.rad = rad;            // radius
    this.speed = speed;        // movement speed 
    this.strength = strength;  // strength (damage dealt upon collision)
    this.max_hp = hp;          // maximum health points
    this.hp = hp;              // health points
    this.slope = slope;        // slope (direction of travel)
    this.rot = 0;              // rotation
    this.live = true;          // is live? (is the projectile still alive?)
    this.opacity = 0;          // opacity
    this.hurt_opacity = 0;     // hurt indicator opacity (red "flash" when damaged)
    this.time_to_live = 300;   // time to live
    this.scale = 0;            // scale
  }
  draw() {
    // set opacity
    colors.black.setAlpha(this.opacity);
    colors.blue.setAlpha(this.opacity);
    colors.red.setAlpha(this.hurt_opacity);

    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.slope + this.rot);
    scale(this.scale);

    // hexagon body outline
    noFill();
    stroke(colors.black);
    hexagon(0, 0, this.rad);

    // hexagonal body
    fill(colors.blue);
    noStroke();
    hexagon(0, 0, this.rad - 2.3);

    // hurt indicator (red "flash" when damaged)
    fill(colors.red);
    hexagon(0, 0, this.rad + 2.3);
    pop();
  }
  animate(i) {
    // spawn animation
    if (this.scale < 1) this.scale += 0.1;
    if (this.opacity < 255 && this.live) this.opacity += 30;

    // hurt indicator animation (red "flash" when damaged)
    this.hurt_opacity -= 10;

    // decrement time to live 
    this.time_to_live--;

    // mark projectile as not live once health or time to live has been depleted
    if (this.time_to_live <= 0 || this.hp <= 0) this.live = false;

    // death animation
    if (!this.live) {
      this.scale += 0.05;
      this.opacity -= 30;
      this.hurt_opacity -= 30;
      // delete projectile
      if (this.opacity <= 0) projectiles.splice(i, 1);
    }

    // update position based on velocity
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

    // rotate projectile based on net velocity ("spinning" effect)
    this.rot += (abs(this.vel.x) + abs(this.vel.y));

    // decrase radius when damaged ("shrinking" effect)
    this.rad = (this.hp / this.max_hp * 0.5 + 0.5) * this.max_rad;
  }
  collide() {
    hazards.forEach(h => {
      let d = dist(h.pos.x, h.pos.y, this.pos.x, this.pos.y); // distance between projectile and hazard
      if (d <= h.rad + this.rad + 8 && this.live && h.live) {
        let o = h.rad + this.rad + 8 - d, // overlap between projectile and hazard

          s1 = slope(this.pos.x, this.pos.y, h.pos.x, h.pos.y), // slope of projectile
          s2 = slope(h.pos.x, h.pos.y, this.pos.x, this.pos.y), // slope of hazard

          r1 = pow(this.rad, 3) / (pow(this.rad, 3) + pow(h.rad, 3)), // size ratio of projectile
          r2 = pow(h.rad, 3) / (pow(this.rad, 3) + pow(h.rad, 3)),    // size ratio of hazard

          v1 = sqrt(sq(this.vel.x) + sq(this.vel.y)), // velocity of projectile
          v2 = sqrt(sq(h.vel.x) + sq(h.vel.y));       // velocity of hazard

        // redirect after collision
        h.vel.x = cos(s1) * (v1 + v2) * r1;
        h.vel.y = sin(s1) * (v1 + v2) * r1;
        this.vel.x = cos(s2) * (v1 + v2) * r2;
        this.vel.y = sin(s2) * (v1 + v2) * r2;

        // prevent projectile and hazard from overlapping
        h.pos.x += cos(s1) * o * r1;
        h.pos.y += sin(s1) * o * r1;
        this.pos.x += cos(s2) * o * r2;
        this.pos.y += sin(s2) * o * r2;

        // show hurt indicator (red "flash" when damaged)
        h.hurt_opacity = 255;
        this.hurt_opacity = 255;

        // apply damage
        h.hp -= this.strength;
        this.hp--;
      }
    });
  }
}

// clicking animation
class Click {
  constructor(pos) {
    this.pos = { x: pos.x, y: pos.y };
    this.rad = 20;
    this.lerp = 0;
    this.stroke_weight = 15;
  }
  draw() {
    push();
    noFill();
    strokeWeight(this.stroke_weight);
    stroke(lerpColor(color(220), color(255), this.lerp));
    ellipse(this.pos.x, this.pos.y, this.rad * 2);
    pop();
  }
  animate(i) {
    this.rad++;
    this.stroke_weight -= 0.5;
    this.lerp += 1 / 30;
    if (this.lerp >= 1) clicks.splice(i, 1);
  }
}


function hexagon(x, y, rad) {
  beginShape();
  for (let i = 0; i <= 6; i++) {
    vertex(x + sin(i * 60) * rad, y + cos(i * 60) * rad);
  }
  endShape();
}

function burst(x, y, rad) {
  beginShape();
  for (let i = 0; i <= 10; i++) {
    vertex(x + sin(i * 45) * rad * 1.2, y + cos(i * 45) * rad * 1.2);
    vertex(x + sin(22.5 + i * 45) * rad * 0.8, y + cos(22.5 + i * 45) * rad * 0.8);
  }
  endShape();
}

function slope(x, y, x2, y2) {
  return atan2(y2 - y, x2 - x);
}

// load font
let roboto_bold;
function preload() {
  roboto_bold = loadFont('assets/Roboto-Black.ttf');
}

let mouse_over;
function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.mouseOver(function () { mouse_over = true; });
  canvas.mouseOut(function () { mouse_over = false; });
  angleMode(DEGREES);
  frameRate(60);
  strokeWeight(5);
  textAlign(CENTER, CENTER);
  textFont(roboto_bold);
}

turrets.push(new Turret({ x: windowWidth / 2, y: windowHeight / 2 }, ...Object.values(turret)));

function windowResized() {
  // recenter each turret
  turrets.forEach(t => {
    t.pos.x = windowWidth / 2;
    t.pos.y = windowHeight / 2;
  });
  // resize canvas
  resizeCanvas(windowWidth, windowHeight);
}

function mouseClicked() {
  clicks.push(new Click({ x: mouseX, y: mouseY }));
}

function draw() {
  // set canvas background color
  background(255);

  clicks.forEach((c, i) => {
    c.draw();
    c.animate(i);
  });

  projectiles.forEach((p, i) => {
    p.draw();
    p.collide();
  });

  hazards.forEach((h, i) => {
    h.draw();
    h.collide(i);
    h.spawnHazards(i);
    h.evade();
  });

  turrets.forEach((t, i) => {
    t.draw();
    t.collide();
    t.spawnHazards();
    t.spawnProjectiles();
  });

  // animate
  projectiles.forEach((p, i) => { p.animate(i) });
  hazards.forEach((h, i) => { h.animate(i) });
  turrets.forEach((t, i) => { t.animate(i) });

  // increase difficulty over time
  if (turrets.length) difficulty += 0.01 / 60;

  // show score
  if (!turrets.length) {
    push();
    colors.black.setAlpha(255);
    colors.red.setAlpha(255);
    strokeWeight(10);
    textSize(100);
    stroke(colors.black);
    fill(colors.red);
    text(score, windowWidth / 2, windowHeight / 2);
    pop();
  }

  // debug info (press left shift to show)
  if (keyIsDown(16)) {
    push();
    colors.black.setAlpha(255);
    colors.red.setAlpha(255);
    fill(colors.black);
    textAlign(LEFT, TOP);
    textSize(15);
    text(`difficulty: ${difficulty.toFixed(3)}×`, 10, 20);
    text(`spawn timer: ${(4 / sqrt(difficulty)).toFixed(2)} sec`, 10, 35);
    text(`hazard count: ${hazards.length}`, 10, 65);
    text(`projectile count: ${projectiles.length}`, 10, 80);
    text(`turret count: ${turrets.length}`, 10, 95);

    let modified_weight = [], total_weight = 0;
    hazard.forEach((h, i) => {
      modified_weight[i] = h.spawn.weight * pow(difficulty, h.spawn.modifier);
      total_weight += modified_weight[i];
    });

    let x = 0;
    hazard.forEach((h, i) => {
      h.color.setAlpha(255);
      noStroke();
      fill(h.color);
      rect(x, 0, modified_weight[i] / total_weight * windowWidth, 10);
      x += modified_weight[i] / total_weight * windowWidth;
    });
    pop();
  }

  // custom cursor
  if (mouse_over) {
    push();
    translate(mouseX, mouseY);
    cursor("NONE");
    strokeCap(PROJECT);
    colors.red.setAlpha(255);
    colors.black.setAlpha(255);
    for (let i = 0; i < 2; i++) {
      stroke(lerpColor(colors.black, colors.red, i));
      strokeWeight(9 - 6 * i);
      point(0, 0);
      noFill();
      for (let j = 0; j < 4; j++) {
        rotate(90);
        line(0, 12.5, 0, 32.5);
      }
      ellipse(0, 0, 45);
    }
    pop();
  }
}
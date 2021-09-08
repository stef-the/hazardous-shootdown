/// <reference path="./p5.global-mode.d.ts"/>

/** 
 * HAZARDOUS SHOOTDOWN
 * Copyright 2021, Kaden Campbell, All rights reserved.
 * 
 * TODO
 * 1. rework difficulty system        [DONE]
 * 2. rework opacity system           [DONE]
 * 3. rework spawning algorithm       [DONE]
 * 4. add crosshair                   [DONE]
 * 5. add turret movement with WASD
 * 6. add camera system
 * 7. add map borders
 */

/**
 * DIFFICULTY
 * increases by 0.01 per second
 * 
 * AS DIFFICULTY INCREASES:
 * increased probability to spawn higher difficulty hazards
 * decreased delay between hazard spawns
 * (press left shift to show difficulty, spawn timer, and hazard spawning probabilities)
 */
let difficulty = 1.00;

/**
 * SCORE
 * destroying hazards increases score
 * different hazard types reward different point values
 * 
 * TYPE             REWARD
 * red              4 points
 * yellow           2 points
 * green            8 points
 * green (small)    4 points
 * orange           12 points
 * purple           32 points
 * purple (small)   2 points
 * indigo           64 points
 * indigo (small)   2 points
 */
let score = 0;

let colors;
let turret;
let hazard;
let projectile;
let crosshair;

function setup() {
  // set color mode
  colorMode(RGB, 1, 1, 1, 1);

  // color settings
  colors = {
    blue: color(0, 0.7, 0.9),
    black: color(0.3, 0.3, 0.3),
    red: color(0.9, 0.3, 0.3),
    green: color(0, 0.9, 0.4),
    purple: color(0.8, 0.5, 1.0),
    yellow: color(1.0, 0.9, 0.3),
    orange: color(0.9, 0.5, 0.3),
    gray: color(0.6, 0.6, 0.6),
    indigo: color(0.5, 0.6, 1.0),
  };

  // turret settings
  turret = {
    rot_speed: 4, // rotation speed    (degrees per frame)
    spread: 8,    // angle of spread   (degrees)
    fire_rate: 4, // fire rate         (shots per second)
    hp: 32,       // health points     (damage required to destroy it)
  };

  // projectile settings
  projectile = {
    rad: 12,     // radius           (pixels)
    speed: 6,    // movement speed   (pixels per frame)
    hp: 2,       // health points    (damage required to destroy it)
  };

  // hazard settings
  hazard = [
    {
      color: colors.red, // color
      rad: 16,           // radius           (pixels)
      speed: 2,          // movement speed   (pixels per frame)
      hp: 4,             // health points    (damage required to destroy it)
      abilities: [],     // abilities        (options: "evasive", "mothership", or "explosive")
      /**
       * SPAWNING PROBABILITY
       * 
       * WEIGHT
       * probability of spawning the current hazard type is calculated by dividing the current weight by the total weight (of all hazard types)
       * (probability = weight / total_weight)
       * 
       * MODIFIER
       * as the difficulty increases, the weight changes based on the modifier
       * modified weight is calculated by multiplying the base weight by the current difficulty raised to the power of the modifier
       * (modified_weight = weight * pow(difficulty, modifier))
       * 
       * EXAMPLES (AT 2.00 DIFFICULTY)
       * WEIGHT   MODIFIER   DIFFICULTY   =   MODIFIED WEIGHT
       * 100      +1.0       2.00         =    200.000
       * 100      -1.0       2.00         =     50.000
       * 100      +5.0       2.00         =   3200.000
       * 100      -5.0       2.00         =      3.125
       * 100      +0.1       2.00         =    107.177
       * 100      -0.1       2.00         =     93.303
      */
      spawn: {
        weight: 400,
        modifier: -1,
      },
    },
    {
      color: colors.yellow,
      rad: 12,
      speed: 6,
      hp: 2,
      abilities: ["evasive"],
      spawn: { weight: 160, modifier: -0.6 },
    },
    {
      color: colors.green,
      rad: 20,
      speed: 2,
      hp: 6,
      abilities: ["explosive"],
      spawn: { weight: 80, modifier: -0.2 },
    },
    {
      color: colors.orange,
      rad: 24,
      speed: 4,
      hp: 12,
      abilities: [],
      spawn: { weight: 40, modifier: 0.2 },
    },
    {
      color: colors.purple,
      rad: 32,
      speed: 0.6,
      hp: 32,
      abilities: ["mothership"],
      spawn: { weight: 5, modifier: 0.6 },
    },
    {
      color: colors.indigo,
      rad: 64,
      speed: 0.2,
      hp: 48,
      abilities: ["mothership"],
      spawn: { weight: 1, modifier: 1.0 },
    },
  ];

  // create canvas
  createCanvas(windowWidth, windowHeight);

  // set angle mode
  angleMode(DEGREES);
  
  // set frame rate
  frameRate(60);

  // set stroke weight
  strokeWeight(5);

  // set text alignment and font
  textAlign(CENTER, CENTER);
  textFont(loadFont("assets/Roboto-Black.ttf"));

  // create player
  turrets.push(new Turret({ x: windowWidth / 2, y: windowHeight / 2 }, ...Object.values(turret)));

  // initialize crosshair
  crosshair = { x: mouseX, y: mouseY, rad: 45 };
}

let hazards = [];
let turrets = [];
let projectiles = [];

// turret class
class Turret {
  constructor(pos, rot_speed, spread, fire_rate, hp) {
    this.pos = { x: pos.x, y: pos.y }; // position
    this.vel = { x: 0, y: 0 };         // velocity
    this.rot_speed = rot_speed;        // rotation speed (degrees per frame)
    this.spread = spread;              // spread (degrees)
    this.fire_rate = fire_rate;        // fire rate (shots per second)
    this.hp = hp;                      // health points
    this.max_hp = hp;                  // maximum health points
    this.hp_display = hp;              // health point display ("smoothly" animate health bar)
    this.recoil = 0;                   // recoil ("knockback" effect when shooting)
    this.scale = 0;                    // scale
    this.rot = 270;                    // rotation
    this.hazard_timer = 0;             // hazard spawning timer
    this.projectile_timer = 0;         // projectile shooting timer
    this.active = true;                // active?
    this.opacity = {
      master: 1,                       // master opacity
      hp_bar: 0,                       // health bar opacity
      hurt_indicator: 0,               // hurt indicator opacity (red "flash" when damaged)
    };
  }
  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    scale(this.scale);
    rotate(this.rot);
    translate(-10, 0);
    rotate(-this.rot);

    // set health bar opacity
    colors.black.setAlpha(this.opacity.master * this.opacity.hp_bar);
    colors.green.setAlpha(this.opacity.master * this.opacity.hp_bar);

    // health bar
    noStroke();
    fill(colors.black);
    rect(-27, 38, 54, 12);
    fill(colors.green);
    rect(-23, 42, this.hp_display / this.max_hp * 46, 4);

    // set opacity
    colors.black.setAlpha(this.opacity.master);
    colors.gray.setAlpha(this.opacity.master);
    colors.blue.setAlpha(this.opacity.master);
    colors.red.setAlpha(this.opacity.master * this.opacity.hurt_indicator);

    // barrel outline
    rotate(this.rot);
    translate(-this.recoil, 0);
    stroke(colors.black);
    noFill();
    rect(0, -10, 50, 20);

    // barrel
    noStroke();
    fill(colors.gray);
    rect(2.5, -7.5, 46, 16);

    // barrel hurt indicator (red "flash" when damaged)
    fill(colors.red);
    rect(-2.5, -12.5, 56, 26);

    // hexagonal body outline
    rotate(-this.rot);
    noFill();
    stroke(colors.black);
    hexagon(0, 0, 30);

    // hexagonal body
    noStroke();
    fill(colors.blue);
    hexagon(0, 0, 30 - 2.6);

    // hexagonal body hurt indicator
    fill(colors.red);
    hexagon(0, 0, 30 + 2.6);

    // score
    fill(colors.black);
    textSize(60 * pow(0.75, score.toString().length));
    text(score, 0, -5 + score.toString().length / 2);

    pop();
  }
  animate(i) {
    // constrain opacity within 0 and 1
    this.opacity.master = constrain(this.opacity.master, 0, 1);
    this.opacity.hp_bar = constrain(this.opacity.hp_bar, 0, 1);

    // constrain health points between 0 and max health points
    this.hp = constrain(this.hp, 0, this.max_hp);

    if (this.active) {
      // spawn animation
      if (this.scale < 1) this.scale += 0.1;
      this.opacity.master += 0.1;

      // animate hurt indicator (red "flash" when damaged)
      this.opacity.hurt_indicator -= 0.05;

      // hide and show health bar
      if (this.hp >= this.max_hp) this.opacity.hp_bar -= 0.1;
      else this.opacity.hp_bar += 0.1;

      // mark turret inactive once health points have depleted
      if (this.hp <= 0) this.active = false;

      // slowly regenerate health points over time
      this.hp += 1 / 60;
    } else {
      // death animation
      this.scale += 0.05;
      this.opacity.master -= 0.1;
      if (this.opacity.master <= 0) turrets.splice(i, 1);
    }

    // "smoothly" animate health bar
    this.hp_display += (this.hp - this.hp_display) / 4;

    // rotate turret to mouse
    let a1 = atan2(crosshair.y - this.pos.y, crosshair.x - this.pos.x),
      a2 = atan2(sin(this.rot), cos(this.rot));
    if (abs(a2 - a1) <= this.rot_speed) {
      this.rot = a1;
    } else {
      let a = (a1 - a2);
      a += a < 0 ? 360 : a >= 360 ? -360 : 0;
      this.rot += a < 180 ? this.rot_speed : -this.rot_speed;
      this.rot += this.rot < 0 ? 360 : this.rot >= 360 ? -360 : 0;
    }

    // recoil animation
    if (this.recoil > 0) this.recoil--;
  }
  collide() {
    hazards.forEach(h => {
      let d = dist(h.pos.x, h.pos.y, this.pos.x, this.pos.y) // distance between hazard and turret
      if (d <= 30 + h.rad + 15 && this.active && h.active) {
        let o = h.rad + 30 + 15 - d, // overlap between turret and hazard

          s = slope(this.pos.x, this.pos.y, h.pos.x, h.pos.y), // collision slope
          v = sqrt(sq(h.vel.x) + sq(h.vel.y));                 // collision velocity

        // redirect hazard after collision
        h.vel.x = cos(s) * v;
        h.vel.y = sin(s) * v;

        // prevent turret and hazard from overlapping
        h.pos.x += cos(s) * o;
        h.pos.y += sin(s) * o;

        // apply damage
        this.hp --;
        h.hp--;

        // show hurt indicator (red "flash" when damaged)
        h.opacity.hurt_indicator = 1;
        this.opacity.hurt_indicator = 1;
      }
    });
  }
  spawnProjectiles() {
    if (mouseIsPressed && this.active) {
      // shoot projectile when timer depletes
      if (this.projectile_timer == 0) {
        // apply recoil to turret ("knockback" effect when shooting)
        this.recoil = 5;
        let pos = {
          x: this.pos.x + cos(this.rot) * (15 + projectile.rad / 2), // x position
          y: this.pos.y + sin(this.rot) * (15 + projectile.rad / 2), // y position
        },
          slope = this.rot + random(-this.spread / 2, this.spread / 2); // slope
        projectiles.push(new Projectile(pos, slope, projectile.rad, projectile.speed, projectile.hp));
        // reset projectile timer to fire rate
        this.projectile_timer = 60 / this.fire_rate;
      }
    }
    // decrement projectile timer
    if (this.projectile_timer > 0) this.projectile_timer--;
  }
  spawnHazards() {
    // spawn hazard when hazard timer depletes
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

      // determine hazard type to spawn
      let r = random(total), type;
      hazard.forEach((h, i) => {
        if (typeof type === "undefined" && r < modified_weight[i]) type = i;
        else r -= modified_weight[i];
      });

      hazards.push(new Hazard(pos, s, vel, ...Object.values(hazard[type])));
      // reset hazard timer based on current difficulty
      this.hazard_timer = 240 / sqrt(difficulty);
    }
    // decrement hazard timer
    this.hazard_timer--;
  }
}

class Hazard {
  constructor(pos, slope, vel, color, rad, speed, hp, abilities) {
    this.pos = { x: pos.x, y: pos.y }; // position
    this.vel = vel;                    // velocity
    this.rad = rad;                    // radius (pixels)
    this.max_rad = rad;                // max radius
    this.speed = speed;                // movement speed (pixels per frame)
    this.hp = hp;                      // health points
    this.max_hp = hp;                  // max health points
    this.color = color;                // color
    this.hp_display = hp;              // health point display
    this.rot = 0;                      // rotation (degrees)
    this.active = true;                // active?
    this.scale = 0;                    // scale
    this.time_to_live = rad * 144;     // time to live (frames)
    this.hazard_timer = 0;             // hazard spawn timer (for hazards with "mothership" ability)
    this.slope = slope;                // slope (direction of travel)
    this.opacity = {
      master: 1,                       // master opacity
      hp_bar: 0,                       // health bar opacity
      hurt_indicator: 0,               // hurt indicator opacity (red "flash" when damaged)
    };
    this.abilities = {                 // abilities
      evasive: abilities.includes("evasive"),
      explosive: abilities.includes("explosive"),
      mothership: abilities.includes("mothership"),
    };
  }
  draw() {
    // set opacity
    colors.black.setAlpha(this.opacity.master);
    this.color.setAlpha(this.opacity.master);

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
    colors.red.setAlpha(this.opacity.master * this.opacity.hurt_indicator);

    // hurt indicator (red "flash" when damaged)
    fill(colors.red);
    burst(0, 0, this.rad + 3.6);
    pop();
    noStroke();

    // set health bar opacity
    colors.black.setAlpha(this.opacity.master * this.opacity.hp_bar);
    colors.green.setAlpha(this.opacity.master * this.opacity.hp_bar);

    // health bar
    fill(colors.black);
    rect(-this.rad - 2, this.rad * 1.2 + 8, this.rad * 2 + 4, 12);
    fill(colors.green);
    rect(-this.rad + 2, this.rad * 1.2 + 12, this.hp_display / this.max_hp * (this.rad * 2 - 4), 4);
    pop();
  }
  animate(i) {
    // find nearest turret within range (to attack)
    let min_distance;
    this.target = null;
    turrets.forEach((t, j) => {
      let distance = dist(t.pos.x, t.pos.y, this.pos.x, this.pos.y);
      if (distance <= 1000 && (distance < min_distance || !min_distance)) {
        min_distance = distance;
        this.target = j;
      }
    });

    if (this.target != null) {
      // attack nearest turret within range
      this.slope = slope(this.pos.x, this.pos.y, turrets[this.target].pos.x, turrets[this.target].pos.y);
      this.vel.x += (cos(this.slope) * this.speed - this.vel.x) / 32;
      this.vel.y += (sin(this.slope) * this.speed - this.vel.y) / 32;

      // decrement time to active
      this.time_to_live--;
    }
    else {
      // drift around idly
      this.vel.x += (cos(this.slope) * this.speed / 4 - this.vel.x) / 64;
      this.vel.y += (sin(this.slope) * this.speed / 4 - this.vel.y) / 64;

      // rapidly decrement time to active
      this.time_to_live -= 30;
    }

    if (this.active) {
      // spawn animation
      if (this.scale < 1) this.scale += 0.1;
      this.opacity.master += 0.1;

      // hide and show health bar
      if (this.hp == this.max_hp) this.opacity.hp_bar -= 0.1;
      else this.opacity.hp_bar += 0.1;

      // animate hurt indicator (red "flash" when damaged)
      this.opacity.hurt_indicator -= 0.05;
    } else {
      // explosive ability
      if (this.abilities.explosive && this.target != null && this.opacity.master >= 1) {
        for (let i = 0; i < 3; i++) {
          let angle = random(360) + i * 120,
            pos = {
              x: this.pos.x + cos(angle) * (this.rad + 12),
              y: this.pos.y + sin(angle) * (this.rad + 12),
            },
            vel = {
              x: cos(angle) * this.speed * 4,
              y: sin(angle) * this.speed * 4,
            },
            rad = this.max_rad * 0.7,
            hp = this.max_hp / 2,
            speed = this.speed * 2;
          hazards.push(new Hazard(pos, angle, vel, this.color, rad, speed, hp, []));
        }
      }

      // death animation
      this.scale += 0.05; // "popping" effect
      this.opacity.master -= 0.1;

      if (this.opacity.master <= 0) {
        // increase score
        if (turrets.length) score += floor(this.max_hp * difficulty);
        // delete hazard from array
        hazards.splice(i, 1);
      }
    }

    // constrain opacity between 0 and 1
    this.opacity.hp_bar = constrain(this.opacity.hp_bar, 0, 1);
    this.opacity.master = constrain(this.opacity.master, 0, 1);

    // constrain health points within 0 and max health points
    this.hp = constrain(this.hp, 0, this.max_hp);

    // "smoothly" update health point display to match health point value
    this.hp_display += (this.hp - this.hp_display) / 4;

    // mark hazard inactive once health points or time to active has depleted
    if (this.hp <= 0 || this.time_to_live <= 0) {
      this.active = false;
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
      if (d <= h.rad + this.rad + 15 && this.active && h.active && i !== j) {
        let o = h.rad + this.rad + 15 - d, // overlap between hazards

          s1 = slope(this.pos.x, this.pos.y, h.pos.x, h.pos.y), // slope of other hazard
          s2 = slope(h.pos.x, h.pos.y, this.pos.x, this.pos.y), // slope of this hazard

          r1 = pow(this.rad, 3) / (pow(this.rad, 3) + pow(h.rad, 3)), // size ratio of other hazard
          r2 = pow(h.rad, 3) / (pow(this.rad, 3) + pow(h.rad, 3)),    // size ratio of this hazard

          v1 = sqrt(sq(this.vel.x) + sq(this.vel.y)), // velocity of other hazard
          v2 = sqrt(sq(h.vel.x) + sq(h.vel.y));       // velocity of this hazard

        // redirect after collision
        h.vel.x = cos(s1) * (v1 + v2) * r1;
        h.vel.y = sin(s1) * (v1 + v2) * r1;
        this.vel.x = cos(s2) * (v1 + v2) * r2;
        this.vel.y = sin(s2) * (v1 + v2) * r2;

        // prevent hazards from overlapping
        h.pos.x += cos(s1) * o * r1;
        h.pos.y += sin(s1) * o * r1;
        this.pos.x += cos(s2) * o * r2;
        this.pos.y += sin(s2) * o * r2;
      }
    });
  }
  spawnHazards(i) {
    if (this.abilities.mothership && this.target != null) {
      if (this.hazard_timer == 0) {
        let angle = slope(this.pos.x, this.pos.y, turrets[this.target].pos.x, turrets[this.target].pos.y) - 90 + random(180),
          pos = {
            x: this.pos.x + cos(angle) * (this.rad + 20),
            y: this.pos.y + sin(angle) * (this.rad + 20),
          },
          rad = 12,
          hp = 2,
          vel = {
            x: cos(angle) * 8,
            y: sin(angle) * 8,
          };
        hazards.push(new Hazard(pos, angle, vel, this.color, rad, 6, hp, []));
        // reset hazard spawn timer
        this.hazard_timer = floor(2880 / this.max_rad);
      }
      else if (this.hazard_timer > 0) this.hazard_timer--; // decrement hazard spawn timer
    }
  }
  evade() {
    if (this.abilities.evasive) {
      projectiles.forEach(p => {
        let d = dist(p.pos.x, p.pos.y, this.pos.x, this.pos.y); // distance between projectile and hazard
        // check if projectile is near hazard
        if (d <= (p.rad + this.rad + 15) * 2 && this.active && p.active) {
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
  constructor(pos, slope, rad, speed, hp) {
    this.pos = { x: pos.x, y: pos.y }; // position
    this.vel = {
      x: cos(slope) * speed,   // x velocity
      y: sin(slope) * speed,   // y velocity
    };
    this.max_rad = rad;        // maximum radius
    this.rad = rad;            // radius
    this.speed = speed;        // movement speed
    this.max_hp = hp;          // maximum health points
    this.hp = hp;              // health points
    this.slope = slope;        // slope (direction of travel)
    this.rot = 0;              // rotation
    this.active = true;          // is active? (is the projectile still aactive?)
    this.opacity = {
      master: 1,       // master opacity
      hurt_indicator: 0, // hurt indicator opacity
    };
    this.time_to_live = 300;   // time to active
    this.scale = 0;            // scale
  }
  draw() {
    // set opacity
    colors.black.setAlpha(this.opacity.master);
    colors.blue.setAlpha(this.opacity.master);
    colors.red.setAlpha(this.opacity.master * this.opacity.hurt_indicator);

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
    if (this.active) {
      // spawn animation
      if (this.scale < 1) this.scale += 0.1;
      this.opacity.master += 0.1;

      // animate hurt indicator (red "flash" when damaged)
      this.opacity.hurt_indicator -= 0.05;

      // decrement time to active 
      this.time_to_live--;

      // mark projectile as inactive once health or time to active has been depleted
      if (this.time_to_live <= 0 || this.hp <= 0) this.active = false;
    } else {
      // death animation
      this.scale += 0.05;
      this.opacity.master -= 0.1;

      // delete projectile
      if (this.opacity.master <= 0) projectiles.splice(i, 1);
    }

    // constrain opacity within 0 and 1
    this.opacity.master = constrain(this.opacity.master, 0, 1);

    // update position based on velocity
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

    // rotate projectile based on net velocity ("spinning" effect)
    this.rot += (abs(this.vel.x) + abs(this.vel.y));

    // decrase radius when damaged ("shrinking" effect)
    this.rad = (this.hp / this.max_hp * 0.3 + 0.7) * this.max_rad;
  }
  collide() {
    hazards.forEach(h => {
      let d = dist(h.pos.x, h.pos.y, this.pos.x, this.pos.y); // distance between projectile and hazard
      if (d <= h.rad + this.rad + 15 && this.active && h.active) {
        let o = h.rad + this.rad + 15 - d, // overlap between projectile and hazard

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
        h.opacity.hurt_indicator = 1;
        this.opacity.hurt_indicator = 1;

        // apply damage
        h.hp --;
        this.hp--;
      }
    });
  }
}

function draw() {
  background(1);

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
    colors.black.setAlpha(1);
    colors.red.setAlpha(1);
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
    colors.black.setAlpha(1);
    colors.red.setAlpha(1);
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
      h.color.setAlpha(1);
      noStroke();
      fill(h.color);
      rect(x, 0, modified_weight[i] / total_weight * windowWidth, 10);
      x += modified_weight[i] / total_weight * windowWidth;
    });
    pop();
  }

  // crosshair
  cursor(ARROW);
  if (focused) {
    cursor("NONE");
    push();
    translate(crosshair.x, crosshair.y);
    scale(crosshair.scale);
    strokeCap(PROJECT);
    colors.red.setAlpha(1);
    colors.black.setAlpha(1);
    for (let i = 0; i < 2; i++) {
      stroke(lerpColor(colors.black, colors.red, i));
      strokeWeight(9 - 6 * i);
      point(0, 0);
      noFill();
      for (let j = 0; j < 4; j++) {
        rotate(90);
        line(0, crosshair.rad * 0.3, 0, crosshair.rad * 0.7);
      }
      rect(-crosshair.rad / 2, -crosshair.rad / 2, crosshair.rad, crosshair.rad);
    }
    pop();
  }

  // move crosshair to cursor
  crosshair.x += (mouseX - crosshair.x) / 4;
  crosshair.y += (mouseY - crosshair.y) / 4;

  // "shrink" crosshair when mouse pressed
  crosshair.rad += ((mouseIsPressed ? 40 : 60) - crosshair.rad) / 4;
}

function windowResized() {
  // recenter turrets
  turrets.forEach(t => {
    t.pos.x = windowWidth / 2;
    t.pos.y = windowHeight / 2;
  });
  // resize canvas
  resizeCanvas(windowWidth, windowHeight);
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
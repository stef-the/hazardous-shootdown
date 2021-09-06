new p5();

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

const hazard = [
  {
    color: colors.red,
    weight: 240,
    weight_modifier: -1.2,
  },
  {
    color: colors.yellow,
    weight: 80,
    weight_modifier: -0.8,
  },
  {
    color: colors.orange,
    weight: 20,
    weight_modifier: -0.4,
  },
  {
    color: colors.purple,
    weight: 4,
    weight_modifier: 0.2,
  },
  {
    color: colors.indigo,
    weight: 1,
    weight_modifier: 0.4,
  },
];

let difficulty = 10.00;

function setup() {
  createCanvas(windowWidth, windowHeight);
  strokeWeight(4);
}

let total_weight = 0;
hazard.forEach(h => {
  h.weight *= pow(difficulty, h.weight_modifier);
  total_weight += h.weight;
});

let roboto_bold;
function preload() {
  roboto_bold = loadFont('assets/Roboto-Bold.ttf');
}

function draw() {
  background(200);

  let x = 0;
  hazard.forEach(h => {
    noStroke();
    fill(h.color);
    rect(x, 0, h.weight / total_weight * windowWidth, windowHeight);
    x += h.weight / total_weight * windowWidth;
  });

  x = windowWidth, y = windowHeight / 2;
  for (let i = hazard.length; i --;) {
    stroke(lerpColor(hazard[i].color, color(0), 0.4))
    x -= hazard[i].weight / total_weight * windowWidth / 2;
    textAlign(CENTER, TOP);
    textFont(roboto_bold, 25);
    fill(255)
    text((hazard[i].weight / total_weight * 100).toFixed(2) + '%', x, y);
    x -= hazard[i].weight / total_weight * windowWidth / 2;
    // y += 20;
  }

}
let config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 600 },
      debug: false,
    },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

let isGameOver = false;
let score = 0;
let scoreText;
let isRefresh = false;
let hitPlayed = false;
let diePlayed = false;
let character;
let base;
let baseImage;
let baseHeight;
let baseWidth;
let speed = -150;
let enemySpeed = -250; // Velocidade dos inimigos
let currentBackground = "bg";
let spawnTime = 1500;
let gameStart = false;
let powerUp;
let invincible = false; // Variável para rastrear o estado de invencibilidade
let invincibleTimer; // Temporizador para controlar a duração da invencibilidade
let game = new Phaser.Game(config);

function preload() {
  this.load.image("background", "assets/GameObjects/background-day.png");
  this.load.image("background2", "assets/GameObjects/background-night.png");
  this.load.image("character1", "assets/GameObjects/yellowbird-midflap.png");
  this.load.image("character2", "assets/GameObjects/yellowbird-downflap.png");
  this.load.image("character3", "assets/GameObjects/yellowbird-upflap.png");
  this.load.image("character4", "assets/GameObjects/yellowbird-fall.png");
  this.load.image("powerup", "assets/GameObjects/powerup.png");
  this.load.image("pillar", "assets/GameObjects/pipe-green.png");
  this.load.image("base", "assets/GameObjects/base.png");
  this.load.image("gameover", "assets/UI/gameover.png");
  this.load.image("score", "assets/UI/score.png");
  this.load.image("retry", "assets/UI/retry.png");
  this.load.image("startGame", "assets/UI/message.png");
  this.load.image("coin", "assets/GameObjects/coin.png");
  this.load.image("enemy", "assets/GameObjects/enemy.png"); // Adicione a imagem do inimigo
  this.load.audio("score", "assets/SoundEffects/point.wav");
  this.load.audio("hit", "assets/SoundEffects/hit.wav");
  this.load.audio("wing", "assets/SoundEffects/wing.wav");
  this.load.audio("die", "assets/SoundEffects/die.wav");
}

function create() {
  let background = this.add.tileSprite(
    0,
    0,
    game.config.width,
    game.config.height,
    "background"
  );
  background.setOrigin(0, 0);
  background.displayWidth = this.sys.game.config.width;
  background.displayHeight = this.sys.game.config.height;

  let background2 = this.add.tileSprite(
    0,
    0,
    game.config.width,
    game.config.height,
    "background2"
  );
  background2.setOrigin(0, 0);
  background2.displayWidth = this.sys.game.config.width;
  background2.displayHeight = this.sys.game.config.height;
  background2.setVisible(false);

  this.backgrounds = { background, background2 };

  let baseImage = this.textures.get("base");
  let baseHeight = baseImage.getSourceImage().height * 1.0;
  let baseWidth = game.config.width;

  base = this.add.tileSprite(
    game.config.width / 2,
    game.config.height - baseHeight / 2,
    baseWidth,
    baseHeight,
    "base"
  );

  this.physics.add.existing(base, true);
  base.setDepth(1);

  let startGameImage = this.add.image(
    game.config.width / 2,
    game.config.height / 3,
    "startGame"
  );
  startGameImage.setOrigin(0.5, 0.5);

  character = this.physics.add.sprite(
    game.config.width / 4,
    game.config.height / 2,
    "character1"
  );
  character.setDepth(1);
  character.setCollideWorldBounds(true);
  character.body.allowGravity = false;
  gameStart = false;

  this.anims.create({
    key: "fly",
    frames: [
      { key: "character1" },
      { key: "character2" },
      { key: "character3" },
    ],
    frameRate: 9,
    repeat: -1,
  });

  this.anims.create({
    key: "fall",
    frames: [{ key: "character4" }],
    frameRate: 9,
    repeat: -1,
  });

  character.anims.play("fly", true);

  this.input.on(
    "pointerdown",
    function (pointer) {
      if (gameStart) return;
      gameStart = true;
      startGameImage.setVisible(false);
      character.body.allowGravity = true;
      this.upperPillars = this.physics.add.group();
      this.lowerPillars = this.physics.add.group();
      this.coins = this.physics.add.group(); // Grupo de moedas
      this.enemies = this.physics.add.group(); // Grupo de inimigos
      this.spawnPillarPair();
      this.physics.add.collider(
        character,
        this.upperPillars,
        hitPillar,
        null,
        this
      );
      this.physics.add.collider(
        character,
        this.lowerPillars,
        hitPillar,
        null,
        this
      );
      this.physics.add.collider(character, base, hitBase, null, this);

      scoreText = this.add.text(game.config.width / 2, 30, "0", {
        fontSize: "32px",
        fontFamily: "Fantasy",
        fill: "white",
      });
      scoreText.setOrigin(0.5, 0.5);
      scoreText.setDepth(1);

      point = this.sound.add("score");
      hit = this.sound.add("hit");
      wing = this.sound.add("wing");
      die = this.sound.add("die");

      this.input.on(
        "pointerdown",
        function (pointer) {
          if (!isRefresh && !isGameOver) {
            wing.play();
            character.setVelocityY(-230);
          }
          isRefresh = false;
        },
        this
      );

      this.physics.add.overlap(character, powerUp, collectPowerUp, null, this);
      this.physics.add.overlap(character, this.coins, collectCoin, null, this); // Colisão com moedas
      this.physics.add.overlap(character, this.enemies, hitEnemy, null, this); // Colisão com inimigos

      // Inicia o temporizador para gerar o power-up mais cedo (por exemplo, a cada 5 segundos)
      this.time.addEvent({
        delay: 5000, // 5 segundos
        callback: this.spawnPowerUp,
        callbackScope: this,
        loop: true,
      });

      // Inicia o temporizador para gerar moedas periodicamente
      this.time.addEvent({
        delay: 3000, // 3 segundos
        callback: this.spawnCoin,
        callbackScope: this,
        loop: true,
      });

      // Inicia o temporizador para gerar inimigos periodicamente
      this.time.addEvent({
        delay: 4000, // 4 segundos
        callback: this.spawnEnemy,
        callbackScope: this,
        loop: true,
      });
    },
    this
  );
}

function changebackground(scene) {
  console.log(currentBackground);
  if (currentBackground == "bg") {
    scene.backgrounds.background.setVisible(false); //Se background atual for dia, passa a noite
    scene.backgrounds.background2.setVisible(true);
    currentBackground = "bg2";
  } else {
    scene.backgrounds.background.setVisible(true);
    scene.backgrounds.background2.setVisible(false);
    currentBackground = "bg";
  }
}

function update() {
  if (!isGameOver) base.tilePositionX += 1; //É o que cria o loop
  if (!gameStart) return;

  let scoreIncremented = false;
  let change = false;
  [this.upperPillars, this.lowerPillars].forEach((group) => {
    group.children.iterate((pillar) => {
      if (!pillar) return;

      if (!pillar.hasPassed && pillar.x + pillar.width < character.x) {
        pillar.hasPassed = true;
        if (!scoreIncremented) {
          score++;
          scoreText.setText(score);
          point.play();
          scoreIncremented = true;
        }
        if (score % 4 == 0 && score != 0 && change == false) {
          change = true;
          changebackground(this);
        }
      }
      if (pillar.x + pillar.width < 0) {
        pillar.destroy();
      }
    });
  });
  scoreIncremented = false;
  if (this.pillarSpawnTime < this.time.now && !isGameOver) {
    this.spawnPillarPair();
  }

  // Verifica a colisão entre o personagem e o power-up
  this.physics.add.overlap(character, powerUp, collectPowerUp, null, this);
  // Verifica a colisão entre o personagem e as moedas
  this.physics.add.overlap(character, this.coins, collectCoin, null, this);
  // Verifica a colisão entre o personagem e os inimigos
  this.physics.add.overlap(character, this.enemies, hitEnemy, null, this);

  if (isGameOver) {
    if (!diePlayed) die.play();
    diePlayed = true;
    character.anims.play("fall", true);
    character.setVelocityX(0);
    character.setVelocityY(0);
    character.body.allowGravity = false;
    [this.upperPillars, this.lowerPillars, this.enemies].forEach((group) =>
      group.children.iterate((pillar) => (pillar.body.velocity.x = 0))
    );
    this.coins.children.iterate((coin) => (coin.body.velocity.x = 0));
      if (powerUp) {
        powerUp.setVelocityX(0);
  }
  }

  // Reativa a física dos pilares que foram desativados durante a invencibilidade
  if (invincible) {
    [this.upperPillars, this.lowerPillars].forEach((group) => {
      group.children.iterate((pillar) => {
        if (!pillar.body.enable) {
          pillar.body.enable = true; // Reativa a física do pilar
        }
      });
    });
  }
}


Phaser.Scene.prototype.spawnPillarPair = function () {
  baseImage = this.textures.get("base");
  baseHeight = baseImage.getSourceImage().height;
  let pillarImage = this.textures.get("pillar");
  let pillarHeight = pillarImage.getSourceImage().height;
  let Offset = (Math.random() * pillarHeight) / 2;
  let k = Math.floor(Math.random() * 3) - 1;
  Offset = Offset * k;
  let gapHeight = (1 / 3) * (game.config.height - baseHeight);
  let lowerY = 2 * gapHeight + pillarHeight / 2 + Offset;
  let upperY = gapHeight - pillarHeight / 2 + Offset;
  let upperPillar = this.upperPillars.create(
    game.config.width,
    upperY,
    "pillar"
  );
  upperPillar.setAngle(180);
  let lowerPillar = this.lowerPillars.create(
    game.config.width,
    lowerY,
    "pillar"
  );
  upperPillar.body.allowGravity = false;
  lowerPillar.body.allowGravity = false;
  upperPillar.setVelocityX(speed);
  lowerPillar.setVelocityX(speed);
  this.pillarSpawnTime = this.time.now + spawnTime;
};

function hitBase(character, base) {
  if (!hitPlayed) hit.play();
  character.anims.play("fall", true);
  base.body.enable = false;
  character.setVelocityX(0);
  character.setVelocityY(0);
  character.body.allowGravity = false;
  [this.upperPillars, this.lowerPillars].forEach((group) =>
    group.children.iterate((pillar) => (pillar.body.velocity.x = 0))
  );
  isGameOver = true;
  let gameOverImage = this.add.image(
    game.config.width / 2,
    game.config.height / 4,
    "gameover"
  );
  gameOverImage.setOrigin(0.5, 0.5);
  let scoreImage = this.add.image(
    game.config.width / 2,
    game.config.height,
    "score"
  );
  scoreImage.setOrigin(0.5, 0.5);
  finalScoreText = this.add.text(
    game.config.width / 2,
    game.config.height,
    score,
    { fontSize: "32px", fontFamily: "Fantasy", fill: "white" }
  );
  finalScoreText.setOrigin(0.5, 0.5);
  this.tweens.add({
    targets: [scoreImage, finalScoreText],
    y: function (target) {
      return target === scoreImage
        ? game.config.height / 2.2
        : game.config.height / 2.1;
    },
    ease: "Power1",
    duration: 500,
    repeat: 0,
    yoyo: false,
  });
  scoreText.destroy();
  let retryImage = this.add.image(
    game.config.width / 2,
    game.config.height / 1.5,
    "retry"
  );
  retryImage.setOrigin(0.5, 0.5);
  retryImage.setScale(0.25);
  retryImage.setInteractive();
  retryImage.on(
    "pointerdown",
    function (pointer) {
      isGameOver = false;
      score = 0;
      gameStart = false;
      this.scene.restart();
      hitPlayed = false;
      diePlayed = false;
      isRefresh = true;
    },
    this
  );
}

function hitPillar(character, pillar) {
  // Ações a serem executadas quando não está no modo invencível
  if (!hitPlayed && !diePlayed) {
    hit.play();
    die.play();
    hitPlayed = true;
    diePlayed = true;
  }
  character.anims.play("fall", true);
  pillar.body.enable = false; // Desativa a física do pilar para parar o movimento
  character.setVelocityX(0); // Para o movimento do personagem
  [this.upperPillars, this.lowerPillars].forEach((group) =>
    group.children.iterate((pillar) => (pillar.body.velocity.x = 0))
  );
  isGameOver = true; // Marca o jogo como terminado
  hitBase.call(this, character, pillar); // Chama a função hitBase
}

// Função para gerar o power-up
Phaser.Scene.prototype.spawnPowerUp = function () {
  let x = game.config.width;
  let y = Phaser.Math.Between(50, game.config.height - 150); // Gera uma posição entre pilares
  powerUp = this.physics.add.sprite(x, y, "powerup");
  powerUp.setScale(0.1); // Reduz drasticamente o tamanho do power-up
  powerUp.setVelocityX(speed); // Define a velocidade do power-up
  powerUp.body.allowGravity = false; // Desativa a gravidade
};

function collectPowerUp(character, powerUp) {
  invincible = true; // Torna o personagem invencível
  powerUp.destroy(); // Destrói o power-up
  console.log("Power-up coletado! Invencibilidade ativada."); // Confirmação de coleta
  
  character.setTint(0xffd700); // Muda a cor do personagem para indicar invencibilidade
  // Desativa a colisão entre o personagem e o pilar
  this.physics.world.colliders.getActive().forEach((collider) => {
    if (collider.object1 === character || collider.object2 === character) {
      collider.active = false;
    }
  });

  // Limpa o temporizador anterior se ainda estiver ativo
  clearTimeout(invincibleTimer);

  // Define um temporizador para desativar a invencibilidade após 5 segundos
  invincibleTimer = setTimeout(() => {
    invincible = false;
    console.log("Invencibilidade desativada.");
    character.clearTint(); // Remove a cor de invencibilidade

    // Reativar a colisão com canos e base
    this.physics.world.colliders.getActive().forEach((collider) => {
      if (collider.object1 === character || collider.object2 === character) {
        collider.active = true;
      }
    });
  }, 5000); // Correção: Fechamento correto do setTimeout
}

// Função para gerar uma moeda
Phaser.Scene.prototype.spawnCoin = function () {
  let x = game.config.width;
  let y = Phaser.Math.Between(50, game.config.height - 150); // Posição Y aleatória entre os limites do jogo
  let coin = this.coins.create(x, y, "coin");
  coin.setScale(0.1); // Ajusta o tamanho da moeda, se necessário
  coin.setVelocityX(speed); // Define a velocidade da moeda
  coin.body.allowGravity = false; // Desativa a gravidade
};

// Função para coletar a moeda
function collectCoin(character, coin) {
  score += 2; // Incrementa a pontuação em 2
  scoreText.setText(score); // Atualiza o texto da pontuação
  coin.destroy(); // Destrói a moeda
  console.log("Moeda coletada!"); // Confirmação de coleta
}

// Função para gerar um inimigo
Phaser.Scene.prototype.spawnEnemy = function () {
  let x = game.config.width;
  let y = Phaser.Math.Between(50, game.config.height - 150); // Posição Y aleatória entre os limites do jogo
  let enemy = this.enemies.create(x, y, "enemy");
  enemy.setScale(0.1); // Ajusta o tamanho do inimigo, se necessário
  enemy.setVelocityX(enemySpeed); // Define a velocidade do inimigo
  enemy.body.allowGravity = false; // Desativa a gravidade
};

// Função para colisão com o inimigo
function hitEnemy(character, enemy) {
  if (invincible) {
    return; // Se o personagem estiver invencível, não faz nada
  }

  if (!hitPlayed && !diePlayed) {
    hit.play();
    die.play();
    hitPlayed = true;
    diePlayed = true;
  }
  character.anims.play("fall", true);
  enemy.body.enable = false;
  character.setVelocityX(0);
  [this.upperPillars, this.lowerPillars, this.enemies].forEach((group) =>
    group.children.iterate((object) => (object.body.velocity.x = 0))
  );
  isGameOver = true;
  hitBase.call(this, character, enemy); // Chama a função hitBase
}

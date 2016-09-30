var GCONFIG = require('./config'),
  MODULE = require('./../../../../common/module'),
  GUTIL = require('./../../../../common/gutil'),
  Position = MODULE.Position,
  Vector = MODULE.Vector,
  Hero = MODULE.Hero,
  Zombie = MODULE.Zombie,
  Machine = MODULE.Machine,
  Bat = MODULE.Bat;

Play = function(GAME) {

  this.isGameReady = false;

  this.lastMiniMapUpdatingTimestamp = 0;
  this.miniMapUpdatingDelay = 500;

  this.enterKeyDelay = 200;
  this.bubbleDelay = 3000;
  this.automoveDelay = 1000;

  /** @type {Object} virtual map, used for calculating */
  this.VTMap = {};

  this.player = {};

  // floor
  this.floorGroup;
  this.vtmapDebugGroup;
  this.stoneShadowGroup;
  this.stoneGroup;

  // monster
  this.monsterShadowGroup;
  this.zombieWeaponGroup;
  this.zombieGroup;
  this.machineWeaponGroup;
  this.machineGroup;
  this.batWeaponGroup;
  this.batGroup;

  // hero
  this.heroShadowGroup;
  this.enemyWeaponGroup;
  this.enemyGroup;
  this.playerWeaponGroup;
  this.playerGroup;

  // emitter
  this.dashEmitterGroup;
  this.damageEmitterGroup;
  this.recoverEmitterGroup;

  // bullet
  this.machineLaserGroup;
  this.enemyArrowGroup;
  this.playerArrowGroup;

  // sky
  this.treeGroup;
  this.miniMapBg;
  this.miniMapUnit;
  this.heroBubbleGroup;

  // input
  this.spaceKey;
  this.enterKey;
};

Play.prototype = {

  /**
   * Get random started creature position
   * not be allowed at
   * - fire
   * - bush
   * - stone
   * 
   * @returns {Position} return walkable position
   */
  getRandomWalkablePosition: function() {
    return this.getCreaturePositionByExclusion([1, 3, 6]);
  },

  /**
   * Get random auto move monster position
   * 
   * @param {Object} monster - monster object
   * @returns {Position} return walkable position
   */
  getRandomAutoMovePosition: function(monster) {
    var targetPos,
      isTooClose = true;

    while (isTooClose) {
      targetPos = this.getRandomStartedCreaturePosition();

      var distance = GAME.physics.arcade.distanceToXY(
        monster,
        targetPos.x,
        targetPos.y
      );

      // if more than minimum distance
      if (distance > 600) {
        isTooClose = false;
      }
    }

    return targetPos;
  },

  /**
   * Update creature lastVector
   * 
   * @param {Object} Phaser sprite object
   */
  updateCreatureLastVector: function(creature) {
    creature.blr.info.lastVector = {
      x: creature.x,
      y: creature.y,
      rotation: creature.rotation,
    };
  },

  forceRestartAutomove: function(monster) {
    var ts = UTIL.getCurrentUtcTimestamp();

    // hacky
    monster.blr.misc.autoMoveTimestamp = ts - 7000;
    this.monsterAutoMove(monster);
  },

  /**
   * Start autoMove mode
   * used by monster only
   * 
   * @param {Object} monster - monster object
   */
  monsterAutoMove: function(monster) {
    var ts = UTIL.getCurrentUtcTimestamp();

    monster.body.velocity.x = 0;
    monster.body.velocity.y = 0;

    // if near hero, then  follow the hero
    // if not, then autoMove
    if (!IS_INVISIBLE && GAME.physics.arcade.distanceBetween(monster, this.player) < monster.blr.misc.visibleRange) {
      monster.blr.misc.isAutomove = false; // unused
      monster.rotation = GAME.physics.arcade.moveToObject(
        monster,
        this.player,
        monster.blr.phrInfo.velocitySpeed
      );

    } else {
      // update isIdle
      if (monster.blr.misc.isIdle &&
        ts - monster.blr.misc.lastIdleTimestamp > this.automoveDelay) {
        monster.blr.misc.isIdle = false;
      }

      if (!monster.blr.misc.isIdle) {
        var distance = GAME.physics.arcade.distanceToXY(
          monster,
          monster.blr.misc.autoMoveTargetPos.x,
          monster.blr.misc.autoMoveTargetPos.y
        );

        // first time, auto move mode
        // if monster
        // 1. start autoMove or keep autoMove if it autoMove less than 6sec or
        // 2. the monster is to close with the target (prevent monster is spinning around the targetPos)
        if ((ts - monster.blr.misc.autoMoveTimestamp > 6000) ||
          distance < 200) {
          var targetPos = this.getRandomAutoMovePosition(monster);

          monster.blr.misc.isAutomove = true; // unused
          monster.blr.misc.autoMoveTargetPos = targetPos;
          monster.blr.misc.autoMoveTimestamp = UTIL.getCurrentUtcTimestamp();
        }

        // keep moving to the existing target position
        monster.rotation = GAME.physics.arcade.moveToXY(
          monster,
          monster.blr.misc.autoMoveTargetPos.x,
          monster.blr.misc.autoMoveTargetPos.y,
          monster.blr.phrInfo.velocitySpeed
        );
      }
    }
  },

  /**
   * get rotation between creature and mouse
   * 
   * @param {[type]} creature
   * @returns {number} rotation
   */
  getRotationBetweenCreatureAndMouse: function(creature) {
    var result = Math.atan2(
      GAME.input.y - (creature.position.y - GAME.camera.y),
      GAME.input.x - (creature.position.x - GAME.camera.x)
    );

    return result;
  },

  /**
   * Update creature follow the mouse
   * So, this function will update
   * - body rotation
   * 
   * @param {[type]} creature
   */
  updateCreatureRotationByFollowingMouse: function(creature) {
    var newX = creature.x,
      newY = creature.y,
      newRotation = this.getRotationBetweenCreatureAndMouse(creature);

    creature.rotation = newRotation;
  },

  isCreatureMove: function(creature) {
    return (creature.x !== creature.blr.info.lastVector.x || creature.y !== creature.blr.info.lastVector.y);
  },

  isCreatureRotate: function(creature) {
    return (creature.rotation !== creature.blr.info.lastVector.rotation);
  },

  /**
   * Update creature shadow
   * using creature position by default
   * 
   * @param {[type]} creature
   * @param {number} [newX]
   * @param {number} [newY]
   */
  updateCreatureShadow: function(creature, newX, newY) {
    if (typeof newX === 'undefined') newX = creature.x;
    if (typeof newY === 'undefined') newY = creature.y;

    creature.blr.shadow.x = newX;
    creature.blr.shadow.y = newY;
  },

  /**
   * Update creature weapon
   * using creature position by default
   * 
   * @param {[type]} creature
   * @param {number} [newX]
   * @param {number} [newY]
   * @param {number} [newRotation]
   */
  updateCreatureWeapon: function(creature, newX, newY, newRotation) {
    if (typeof newX === 'undefined') newX = creature.x;
    if (typeof newY === 'undefined') newY = creature.y;
    if (typeof newRotation === 'undefined') newRotation = creature.rotation;

    creature.blr.weapon.x = newX;
    creature.blr.weapon.y = newY;
    creature.blr.weapon.rotation = newRotation;
  },

  /**
   * Get enemy object by playerId
   * implemented "break" hack
   * 
   * @see http://stackoverflow.com/questions/2641347/how-to-short-circuit-array-foreach-like-calling-break
   * 
   * @param {string} playerId
   * @returns {Object} Phaser sprite object and including with other components
   */
  getEnemyByPlayerId: function(playerId) {
    var isFound = false,
      result = {},
      BreakException = {};

    try {
      this.enemyGroup.forEach(function(hero) {
        if (hero.blr.info.id === playerId) {
          isFound = true;
          result = hero;
          throw BreakException;
        }
      }, this);

    } catch (e) {
      if (e !== BreakException) throw e;
    }

    if (!isFound) {
      UTIL.serverBugLog('getEnemyByPlayerId', 'Not found playerId', playerId);
    }

    return result;
  },

  /*================================================================ Log
   */

  /**
   * Log creature respawning into log list
   * 
   * @param {Creature} creature
   */
  logCreatureRespawning: function(creature) {
    var logText = creature.blr.info.type + ' ' + creature.blr.info.id +
      ' (' + creature.blr.info.life + ') is respawn at ' + creature.body.x + ', ' + creature.body.y;
    UI.addTextToLogList(logText);
  },

  /**
   * Log creature message into log list
   * 
   * @param {Creature} creature
   */
  logCreatureMessage: function(creature) {
    var logText = creature.blr.info.type + ' ' + creature.blr.info.id +
      ': ' + creature.blr.info.lastMessage;
    UI.addTextToLogList(logText);
  },

  /**
   * Log on player connect
   * 
   * @param {CreatureInfo} playerInfo
   */
  logOnPlayerConnect: function(playerInfo) {
    var logText = 'hero ' + playerInfo.id + ' connect';
    UI.addTextToLogList(logText);
  },

  /**
   * Log on player disconnect
   * 
   * @param {CreatureInfo} playerInfo
   */
  logOnPlayerDisconnect: function(playerInfo) {
    var logText = 'hero ' + playerInfo.id + ' disconnect';
    UI.addTextToLogList(logText);
  },

  /**
   * Log on creature is recovered
   * 
   * @param {Phaser.Sprite} creature - enemy that contain `Creature` object in `blr` property
   * @param {string} recoveredFrom - where is the recover come frome
   */
  logOnCreatureIsRecovered: function(creature, recoveredFrom) {
    var logText = '+1 life ' + creature.blr.info.type + ' ' + creature.blr.info.id +
          ' (' + creature.blr.info.life++ + ' > ' + creature.blr.info.life + ')  was recovered from ' + recoveredFrom;
    
    UI.addTextToLogList(logText);
  },

  /**
   * Log on creature is damaged
   * 
   * @param {Phaser.Sprite} creature - enemy that contain `Creature` object in `blr` property
   * @param {string} damageFrom - where is the damage come frome
   */
  logOnCreatureIsDamaged: function(creature, damageFrom) {
    var logText = '-1 life ' + creature.blr.info.type + ' ' + creature.blr.info.id +
        ' (' + creature.blr.info.life-- + ' > ' + creature.blr.info.life + ')  was damaged from ' + damageFrom;
    
    UI.addTextToLogList(logText);
  },

  /**
   * Log on creature is died
   * 
   * @param {Phaser.Sprite} creature - enemy that contain `Creature` object in `blr` property
   * @param {string} damageFrom - where is the damage come frome
   */
  logOnCreatureIsDied: function(creature, damageFrom) {
    var logText = creature.blr.info.type + ' ' + creature.blr.info.id + ' was died by ' + damageFrom;

    UI.addTextToLogList(logText);
  },

  /*================================================================ Bubble
   */

  setHeroBubble: function(creature) {
    var bubbleStyle = {
        font: '12px ' + GCONFIG.mainFontFamily,
        fill: '#000',
        backgroundColor: '#ffffff',
        align: 'center',
      },
      bubble = GAME.add.text(0, 0, '', bubbleStyle);

    bubble.anchor.set(0.5, 2.4);
    bubble.padding.set(0);
    bubble.visible = false;

    creature.blr.bubble = bubble;
    this.heroBubbleGroup.add(creature.blr.bubble);
    this.updateCreatureBubble(creature);
  },

  updateCreatureBubble: function(creature) {
    if (creature.blr.bubble.visible && creature.blr.info.lastMessage) {
      this.updateCreatureBubbleText(creature);
      this.updateCreatureBubblePosition(creature);
    }
  },

  updateCreatureBubbleText: function(creature) {
    var bubbletext = creature.blr.info.lastMessage;
    creature.blr.bubble.setText(bubbletext);
  },

  updateCreatureBubblePosition: function(creature) {
    var bubbleLeftOffset = 0,
      bubbleTopOffset = 0;

    creature.blr.bubble.x = creature.x;
    creature.blr.bubble.y = creature.y;
  },

  updateCreatureBubbleVisibility: function(creature) {
    var ts = UTIL.getCurrentUtcTimestamp();

    if (ts - creature.blr.info.lastMessageTimestamp > this.bubbleDelay) {
      creature.blr.bubble.visible = false;
    }
  },

  /*================================================================ Label
   */

  setCreatureLabel: function(creature) {
    var labelStyle = {
        font: '13px ' + GCONFIG.mainFontFamily,
        fill: '#fff',
        align: 'left',
      },
      label = GAME.add.text(0, 0, '', labelStyle);

    creature.addChild(label);
    creature.blr.label = label;
    this.updateCreatureLabel(creature);
  },

  updateCreatureLabel: function(creature) {
    this.updateCreatureLabelText(creature);

    // update label position only 1 time
    // cause we using `child`
    this.updateCreatureLabelPosition(creature);
  },

  updateCreatureLabelText: function(creature) {
    var labeltext = creature.blr.info.id + ' ' + creature.blr.info.life + '/' + creature.blr.info.maxLife;
    creature.blr.label.setText(labeltext);
  },

  updateCreatureLabelPosition: function(creature) {
    var labelLeftOffset = 0,
      labelTopOffset = -10;

    creature.blr.label.x = -(creature.blr.label.width / 2) - labelLeftOffset;
    creature.blr.label.y = -(creature.height / 2) - (creature.blr.label.height / 2) + labelTopOffset;
  },

  /*================================================================ Spawn
   */

  /**
   * Spawn zombie
   * 
   * @param {CreatureInfo} creatureInfo
   */
  spawnZombie: function(creatureInfo) {
    // init
    var monsterBlr = new Zombie(creatureInfo);
    var monster = this.spawnMonster(this.zombieGroup, monsterBlr);

    // animation
    monster.animations.add('blink', [0, 1, 0]);

    // weapon
    var weapon = GAME.add.sprite(monster.x, monster.y, 'handsWeapon');
    weapon.anchor.set(0.5);
    weapon.animations.add('attack', [0, 1, 2, 3, 4]);
    weapon.animations.play('attack', 10, true, false);
    GAME.physics.enable(weapon);
    monster.blr.weapon = weapon;
    this.zombieWeaponGroup.add(monster.blr.weapon);

    // optional
  },

  /**
   * Spawn machine
   * 
   * @param {CreatureInfo} creatureInfo
   */
  spawnMachine: function(creatureInfo) {
    // init
    var monsterBlr = new Machine(creatureInfo);
    var monster = this.spawnMonster(this.machineGroup, monsterBlr);

    // animation
    monster.animations.add('blink', [0, 1, 0]);

    // weapon
    var weapon = GAME.add.sprite(monster.x, monster.y, 'laserTurretWeapon');
    weapon.anchor.set(0.5);
    weapon.animations.add('attack', [0, 1, 2]);
    weapon.animations.play('attack', 10, true, false);
    GAME.physics.enable(weapon);
    monster.blr.weapon = weapon;
    this.machineWeaponGroup.add(monster.blr.weapon);

    // bullet
    var bulletGroup = GAME.add.group();
    bulletGroup.enableBody = true;
    bulletGroup.physicsBodyType = Phaser.Physics.ARCADE;
    bulletGroup.createMultiple(monster.blr.misc.nBullets, 'laserBullet');
    bulletGroup.setAll('anchor.x', 0.5);
    bulletGroup.setAll('anchor.y', 0.5);
    bulletGroup.setAll('outOfBoundsKill', true);
    bulletGroup.setAll('checkWorldBounds', true);
    monster.blr.bullet = bulletGroup;
    this.machineLaserGroup.add(monster.blr.bullet);

    // optional
    monster.body.moves = false;
  },

  /**
   * Spawn bat
   * 
   * @param {CreatureInfo} creatureInfo
   */
  spawnBat: function(creatureInfo) {
    // init
    var monsterBlr = new Bat(creatureInfo);
    var monster = this.spawnMonster(this.batGroup, monsterBlr);

    // animation
    monster.animations.add('blink', [0, 1, 0]);

    // weapon
    var weapon = GAME.add.sprite(monster.x, monster.y, 'wingsWeapon');
    weapon.anchor.set(0.5);
    weapon.animations.add('attack', [0, 1, 2, 3]);
    weapon.animations.play('attack', 10, true, false);
    GAME.physics.enable(weapon);
    monster.blr.weapon = weapon;
    this.batWeaponGroup.add(monster.blr.weapon);

    // optional
    monster.scale.setTo(0.7, 0.7);
    monster.blr.shadow.scale.setTo(0.5, 0.5);
    monster.blr.weapon.scale.setTo(0.7, 0.7);
  },

  /**
   * Spawn monster
   * 
   * @param {Object} monsterGroup - Phaser Group object
   * @param {Object} monsterBlr
   * 
   * @return {DisplayObject} Phaser DisplayObject
   */
  spawnMonster: function(monsterGroup, monsterBlr) {
    var monsterPhrInfo = monsterBlr.phrInfo,
      startVector = monsterBlr.info.startVector;

    var monsterSpriteName = monsterPhrInfo.spriteName,
      monsterBodyOffset = monsterPhrInfo.bodyOffset,
      monsterBodyWidth = monsterPhrInfo.width,
      monsterBodyHeight = monsterPhrInfo.height,
      monsterBodyWidthSize = monsterBodyWidth - monsterBodyOffset * 2,
      monsterBodyHeightSize = monsterBodyHeight - monsterBodyOffset * 2,
      monsterBodyMass = monsterPhrInfo.bodyMass;

    // sprite
    var monster = monsterGroup.create(startVector.x, startVector.y, monsterSpriteName);
    GAME.physics.enable(monster);
    monster.anchor.set(0.5);

    // body
    monster.body.setSize(
      monsterBodyWidthSize,
      monsterBodyHeightSize,
      monsterBodyOffset,
      monsterBodyOffset
    );
    monster.body.tilePadding.set(monsterBodyOffset, monsterBodyOffset);
    monster.body.mass = monsterBodyMass;
    monster.body.rotation = startVector.rotation;
    monster.body.collideWorldBounds = true;

    // blr
    monster.blr = monsterBlr;

    // shadow
    var shadow = GAME.add.sprite(monster.x, monster.y, 'shadow');
    shadow.anchor.set(0.1);
    shadow.scale.setTo(0.7, 0.7);
    shadow.alpha = .3;
    monster.blr.shadow = shadow;
    this.monsterShadowGroup.add(monster.blr.shadow);

    // label
    this.setCreatureLabel(monster);

    // misc
    this.logCreatureRespawning(monster);
    monster.blr.misc.autoMoveTargetPos = new Position(monster.x, monster.y);
    UI.addCreatureIdToCreatureList(monster.blr.info.id, 'monster');

    return monster;
  },

  /**
   * Spawn player
   * 
   * @param {Object} playerInfo
   */
  spawnPlayer: function(playerInfo) {
    var heroBlr = new Hero(playerInfo);

    this.player = this.spawnHero(heroBlr, heroBlr.info.lastVector);
    this.playerGroup.add(this.player);
    this.playerWeaponGroup.add(this.player.blr.weapon);
    this.playerArrowGroup.add(this.player.blr.bullet);

    UI.addCreatureIdToCreatureList(this.player.blr.info.id, 'player');

    if (IS_IMMORTAL) {
      this.player.blr.misc.isImmortal = true;
    }
  },

  /**
   * Spawn enemy
   * 
   * @param {Object} playerInfo
   */
  spawnEnemy: function(playerInfo) {
    var heroBlr = new Hero(playerInfo);

    var enemy = this.spawnHero(heroBlr, heroBlr.info.lastVector);
    this.enemyGroup.add(enemy);
    this.enemyWeaponGroup.add(enemy.blr.weapon);
    this.enemyArrowGroup.add(enemy.blr.bullet);

    UI.addCreatureIdToCreatureList(enemy.blr.info.id, 'enemy');
  },

  /**
   * Spawn hero
   * 
   * @param {Object} heroBlr
   */
  spawnHero: function(heroBlr, currentVector) {
    if (typeof currentVector === 'undefined') currentVector = heroBlr.info.startVector;
    var bodyOffset = 8,
      bodySize = 46 - bodyOffset * 2;

    // init & sprite
    var hero = GAME.add.sprite(currentVector.x, currentVector.y, 'hero');
    hero.rotation = currentVector.rotation;
    hero.blr = heroBlr;
    hero.anchor.set(0.5);

    // body
    GAME.physics.enable(hero);
    hero.body.collideWorldBounds = true;
    hero.body.setSize(bodySize, bodySize, bodyOffset, bodyOffset);
    hero.body.tilePadding.set(bodyOffset, bodyOffset);
    hero.body.maxAngular = 500;
    hero.body.angularDrag = 50;

    // shadow
    var shadowTmp = GAME.add.sprite(currentVector.x, currentVector.y, 'shadow');
    shadowTmp.anchor.set(0.1);
    shadowTmp.scale.setTo(0.7, 0.7);
    shadowTmp.alpha = .3;
    hero.blr.shadow = shadowTmp;
    this.heroShadowGroup.add(hero.blr.shadow);

    // weapon
    var weaponTmp = GAME.add.sprite(currentVector.x, currentVector.y, 'bowWeapon');
    weaponTmp.rotation = currentVector.rotation;
    weaponTmp.animations.add('attack', [0, 1, 2, 3, 4, 5, 0]);
    weaponTmp.anchor.set(0.3, 0.5);
    weaponTmp.scale.setTo(0.5);
    hero.blr.weapon = weaponTmp;

    // animation
    hero.animations.add('blink', [0, 1, 0]);
    hero.animations.add('recover', [0, 2, 0]);

    // bullet
    var bulletGroup = GAME.add.group();
    bulletGroup.enableBody = true;
    bulletGroup.physicsBodyType = Phaser.Physics.ARCADE;
    bulletGroup.createMultiple(hero.blr.misc.nBullets, 'arrowBullet');
    bulletGroup.setAll('anchor.x', 0.5);
    bulletGroup.setAll('anchor.y', 0.5);
    bulletGroup.setAll('outOfBoundsKill', true);
    bulletGroup.setAll('checkWorldBounds', true);
    hero.blr.bullet = bulletGroup;

    // label
    this.setCreatureLabel(hero);

    // bubble
    this.setHeroBubble(hero);

    // misc
    hero.blr.reset();
    this.logCreatureRespawning(hero);

    return hero;
  },

  /**
   * Respawn creature
   * 
   * @param {Creature} creature
   */
  respawnCreature: function(creature) {
    var newPosition = this.getRandomStartedCreaturePosition();

    creature.blr.info.reset();
    creature.reset(newPosition.x, newPosition.y);
    this.updateCreatureLabelText(creature);
    this.updateCreatureWeapon(creature);
    this.updateCreatureShadow(creature);
    this.logCreatureRespawning(creature);
  },

  /*================================================================ Map
   */

  debugMap: function() {
    var i = 0, // row
      j = 0, // column
      renderPadding = 4;
    mapData = this.VTMap.data,
      mapTileWidth = this.VTMap.mapTileWidth,
      mapTileHeight = this.VTMap.mapTileHeight,
      nTileWidth = this.VTMap.nTileWidth,
      nTileHeight = this.VTMap.nTileHeight;

    var bmdWidth = mapTileWidth - renderPadding * 2,
      bmdHeight = mapTileHeight - renderPadding * 2;

    var bmd = GAME.add.bitmapData(bmdWidth, bmdHeight);
    bmd.ctx.beginPath();
    bmd.ctx.rect(0, 0, bmdWidth, bmdHeight);
    bmd.ctx.fillStyle = 'rgba(240, 240, 100, .6)';
    bmd.ctx.fill();

    for (i = 0; i < nTileWidth; i++) {
      for (j = 0; j < nTileHeight; j++) {
        var mapPoint = mapData[i][j];

        // walkable
        if (mapPoint !== 0) {
          var x = (j * mapTileHeight) + renderPadding;
          y = (i * mapTileWidth) + renderPadding,
            drawnObject = GAME.add.sprite(x, y, bmd);

          this.vtmapDebugGroup.add(drawnObject);
        }
      }
    }
  },

  setMiniMap: function() {
    // tile size must be square
    var miniMapSize = 5,
      miniMapBgBmd = GAME.add.bitmapData(
        miniMapSize * this.VTMap.nTileWidth,
        miniMapSize * this.VTMap.nTileHeight
      ),
      miniMapBgSpr;

    // row
    for (var i = 0; i < this.VTMap.nTileHeight; i++) {
      // column
      for (var j = 0; j < this.VTMap.nTileWidth; j++) {
        var mapData = this.VTMap.data[i][j],
          color = '#36a941',
          miniMapX = j * miniMapSize,
          miniMapY = i * miniMapSize;

        switch (mapData) {
          // brush
          case 1:
            color = '#4ed469';
            break;
            // stone
          case 3:
            color = '#b4baaf';
            break;
            // well
          case 5:
            color = '#409fff';
            break;
            // fire
          case 6:
            color = '#f07373';
            break;
        }

        miniMapBgBmd.ctx.fillStyle = color;
        // actually, param 3 and 4 should be 5 (equal to miniMapSize)
        // but I want some kind of padding between each tile
        // so, it should be 4 instead 
        miniMapBgBmd.ctx.fillRect(miniMapX, miniMapY, 4, 4);
      }
    }

    miniMapBgSpr = GAME.add.sprite(6, 6, miniMapBgBmd);
    miniMapBgSpr.alpha = 0.6;
    miniMapBgSpr.fixedToCamera = true;
    this.miniMapBg.add(miniMapBgSpr);
  },

  /**
   * Update unit (in miniMap)
   */
  updateMinimap: function() {
    var ts = UTIL.getCurrentUtcTimestamp();

    if (ts - this.lastMiniMapUpdatingTimestamp > this.miniMapUpdatingDelay) {
      // tile size must be square
      var miniMapSize = 5,
        miniMapUnitBmd = GAME.add.bitmapData(
          miniMapSize * this.VTMap.nTileWidth,
          miniMapSize * this.VTMap.nTileHeight
        ),
        miniMapUnitSpr;

      // destroy
      this.miniMapUnit.forEachAlive(function(unitSpr) {
        unitSpr.destroy();
      });

      // create new one
      miniMapUnitBmd = this.addCreatureGroupToMiniMapUnitBmd(miniMapUnitBmd, this.playerGroup, '#fff');
      miniMapUnitBmd = this.addCreatureGroupToMiniMapUnitBmd(miniMapUnitBmd, this.enemyGroup, '#60f0ff');
      miniMapUnitBmd = this.addCreatureGroupToMiniMapUnitBmd(miniMapUnitBmd, this.zombieGroup, '#776b9f');
      miniMapUnitBmd = this.addCreatureGroupToMiniMapUnitBmd(miniMapUnitBmd, this.machineGroup, '#776b9f');
      miniMapUnitBmd = this.addCreatureGroupToMiniMapUnitBmd(miniMapUnitBmd, this.batGroup, '#776b9f');

      // create sprite and add to group
      miniMapUnitSpr = GAME.add.sprite(6, 6, miniMapUnitBmd);
      miniMapUnitSpr.fixedToCamera = true;
      this.miniMapUnit.add(miniMapUnitSpr);

      // update timestamp
      this.lastMiniMapUpdatingTimestamp = ts;
    }
  },

  addCreatureGroupToMiniMapUnitBmd: function(miniMapUnitBmd, creatureGroup, colorCode) {
    var miniMapSize = 5;

    creatureGroup.forEachAlive(function(creature) {
      var x = creature.x,
        y = creature.y,
        tileIndex = GUTIL.convertPointToTileIndex(x, y),
        miniMapX = tileIndex.x * miniMapSize,
        miniMapY = tileIndex.y * miniMapSize;

      miniMapUnitBmd.ctx.fillStyle = colorCode;
      // actually, it should be the same as `setMiniMap`
      // but I want to add more padding
      miniMapUnitBmd.ctx.fillRect(miniMapX + 1, miniMapY + 1, 2, 2);
    });

    return miniMapUnitBmd;
  },

  /*================================================================ Emitter
   */

  setDashEmitter: function() {
    var nEmitter = 60;

    this.dashEmitterGroup = GAME.add.emitter(0, 0, nEmitter);
    this.dashEmitterGroup.makeParticles('dashParticle');
    this.dashEmitterGroup.gravity = 0;
    this.dashEmitterGroup.minRotation = 0;
    this.dashEmitterGroup.maxRotation = 0;
    this.dashEmitterGroup.minParticleSpeed.setTo(-40, -40);
    this.dashEmitterGroup.maxParticleSpeed.setTo(40, 40);
    this.dashEmitterGroup.bounce.setTo(0.5, 0.5);
  },

  setRecoverEmitter: function() {
    var nEmitter = 30;

    this.recoverEmitterGroup = GAME.add.emitter(0, 0, nEmitter);
    this.recoverEmitterGroup.makeParticles('recoverParticle');
    this.recoverEmitterGroup.gravity = 0;
    this.recoverEmitterGroup.minParticleSpeed.setTo(-200, -200);
    this.recoverEmitterGroup.maxParticleSpeed.setTo(200, 200);
  },

  setDamageEmitter: function() {
    var nEmitter = 30;

    this.damageEmitterGroup = GAME.add.emitter(0, 0, nEmitter);
    this.damageEmitterGroup.makeParticles('damageParticle');
    this.damageEmitterGroup.gravity = 0;
    this.damageEmitterGroup.minParticleSpeed.setTo(-200, -200);
    this.damageEmitterGroup.maxParticleSpeed.setTo(200, 200);
  },

  playDashParticle: function(creature) {
    this.dashEmitterGroup.x = creature.x;
    this.dashEmitterGroup.y = creature.y;
    this.dashEmitterGroup.start(true, 280, null, 20);
  },

  playRecoverParticle: function(creature) {
    this.recoverEmitterGroup.x = creature.x;
    this.recoverEmitterGroup.y = creature.y;
    this.recoverEmitterGroup.start(true, 280, null, 20);
  },

  playDamageParticle: function(creature) {
    this.damageEmitterGroup.x = creature.x;
    this.damageEmitterGroup.y = creature.y;
    this.damageEmitterGroup.start(true, 280, null, 20);
  },

  fadeDashEmitter: function() {
    this.dashEmitterGroup.forEachAlive(function(particle) {
      particle.alpha = GAME.math.clamp(particle.lifespan / 100, 0, 1);
    }, this);
  },

  fadeRecoverEmitter: function() {
    this.recoverEmitterGroup.forEachAlive(function(particle) {
      particle.alpha = GAME.math.clamp(particle.lifespan / 100, 0, 1);
    }, this);
  },

  fadeDamageEmitter: function() {
    this.damageEmitterGroup.forEachAlive(function(particle) {
      particle.alpha = GAME.math.clamp(particle.lifespan / 100, 0, 1);
    }, this);
  },

  fadeAllEmitters: function() {
    this.fadeDashEmitter();
    this.fadeRecoverEmitter();
    this.fadeDamageEmitter();
  },

  /*================================================================ Overlap
   */

  /**
   * Callback event when hit well
   * 
   * @param {[type]} creature [description]
   * @param {[type]} tile     [description]
   */
  onCreatureOverlapWell: function(creature, tile) {
    var isWelled = this.onCreatureIsRecovered(creature, 'well');

    // if creature is player,
    // then broadcast
    if (isWelled && creature.blr.info.type === 'hero') {
      var data = {
        playerInfo: creature.blr.info,
      };
      SOCKET.emit(EVENT_NAME.player.isWelled, data);
    }
  },

  /**
   * Callback event when hit fire
   * 
   * @param {[type]} creature [description]
   * @param {[type]} tile     [description]
   */
  onCreatureOverlapFire: function(creature, tile) {
    var isDamaged = this.onCreatureIsDamaged(creature, 'fire');

    // if creature is player,
    // then broadcast
    if (isDamaged && creature.blr.info.type === 'hero') {
      var data = {
        playerInfo: creature.blr.info,
      };
      SOCKET.emit(EVENT_NAME.player.isFired, data);
    }
  },

  onPlayerOverlapZombie: function(player, monster) {

  },

  onPlayerOverlapMachine: function(player, monster) {

  },

  onPlayerOverlapBat: function(player, monster) {

  },

  onPlayerOverlapZombieWeapon: function(player, monsterWeapon) {
    var damageFrom = 'zombie hands',
      isDamaged = this.onCreatureIsDamaged(player, damageFrom);

    if (isDamaged) {
      var data = {
        playerInfo: player.blr.info,
        damageFrom: damageFrom,
      }; 
      SOCKET.emit(EVENT_NAME.player.isOverlappedByMonster, data);
    }
  },

  onPlayerOverlapMachineWeapon: function(player, monsterWeapon) {
    var damageFrom = 'machine\'s turret',
      isDamaged = this.onCreatureIsDamaged(player, damageFrom);

    if (isDamaged) {
      var data = {
        playerInfo: player.blr.info,
        damageFrom: damageFrom,
      }; 
      SOCKET.emit(EVENT_NAME.player.isOverlappedByMonster, data);
    }
  },

  onPlayerOverlapBatWeapon: function(player, monsterWeapon) {
    var damageFrom = 'bat wings',
      isDamaged = this.onCreatureIsDamaged(player, damageFrom);

    if (isDamaged) {
      var data = {
        playerInfo: player.blr.info,
        damageFrom: damageFrom,
      }; 
      SOCKET.emit(EVENT_NAME.player.isOverlappedByMonster, data);
    }
  },

  onMachineLaserOverlapPlayer: function(laser, player) {
    this.playDamageParticle(player);
    laser.kill();
    this.onCreatureIsDamaged(player, 'laser');
  },

  onPlayerArrowOverlapStoneGroup: function(arrow, stone) {

  },

  onPlayerArrowOverlapMonster: function(arrow, monster) {
    this.playDamageParticle(monster);
    arrow.kill();
    this.onCreatureIsDamaged(monster, 'arrow');
  },

  /*================================================================ Collide
   */

  onMonsterCollideStoneGroup: function(monster, stone) {
    var ts = UTIL.getCurrentUtcTimestamp();
    monster.blr.updateLastIdleTimestamp(ts);
    monster.blr.misc.isIdle = true;

    this.forceRestartAutomove(monster);
  },

  onPlayerCollideStoneGroup: function() {

  },

  onPlayerCollideMonster: function() {

  },

  /*================================================================ Game event
   */

  onCreatureIsRecovered: function(creature, recoveredFrom) {
    var isWelled = false;

    if (creature.blr.info.life < creature.blr.info.maxLife) {
      var ts = UTIL.getCurrentUtcTimestamp();

      if (ts > creature.blr.info.lastRecoverTimestamp + creature.blr.info.immortalDelay) {
        isWelled = true;
        creature.blr.updateLastRecoverTimestamp();
        this.playRecoverParticle(creature);
        creature.animations.play('recover', 10, false, false);
        this.logOnCreatureIsRecovered(creature, recoveredFrom);
      }
    }

    return isWelled;
  },

  /**
   * When creature is damaged
   * 
   * @param {Object} creature - creature object
   * @param {string} damageFrom - where is the damage come frome
   */
  onCreatureIsDamaged: function(creature, damageFrom) {
    var ts = UTIL.getCurrentUtcTimestamp(),
      isDamaged = false;

    if (creature.alive &&
      creature.blr.info.life > 0 &&
      !creature.blr.misc.isImmortal &&
      (ts > creature.blr.info.lastDamageTimestamp + creature.blr.info.immortalDelay)) {
      isDamaged = true;
      creature.blr.updateLastDamageTimestamp();
      this.playDamageParticle(creature);
      creature.animations.play('blink', 10, false, false);
      this.logOnCreatureIsDamaged(creature, damageFrom);

      // is died
      if (creature.blr.info.life <= 0) {
        creature.blr.shadow.kill();
        creature.blr.weapon.kill();
        creature.kill();
        this.logOnCreatureIsDied(creature, damageFrom);

        if (creature.blr.info.type === 'hero') {
          // on hero is died
          var data = {
            playerInfo: creature.blr.info,
            damageFrom: damageFrom,
          };
          SOCKET.emit(EVENT_NAME.player.isDied, data);

        } else {
          // on monster is died
          // TODO: complete it
        }
      }
    }

    return isDamaged;
  },

  /*================================================================ Event
   */

  playerFireArrow: function(hero) {
    var ts = UTIL.getCurrentUtcTimestamp();

    if (ts > hero.blr.misc.nextFireTimestamp &&
      hero.blr.bullet.countDead() > 0) {

      // update body rotation
      this.updateCreatureRotationByFollowingMouse(hero);

      // update last vector (update rotation)
      this.updateCreatureLastVector(hero);

      // update next fire
      hero.blr.misc.nextFireTimestamp = ts + hero.blr.misc.fireRate;

      // fire
      var targetPos = new Position(GAME.input.activePointer.worldX, GAME.input.activePointer.worldY);
      this.heroFireArrow(hero, targetPos);

      // broadcast `fire` event
      var data = {
        playerInfo: this.player.blr.info,
        targetPos: targetPos,
      };
      SOCKET.emit(EVENT_NAME.player.fire, data);
    }
  },

  enemyFireArrow: function(hero, targetPos) {
    // force fire
    this.heroFireArrow(hero, targetPos);
  },

  /**
   * Fire arrow
   * 
   * @param {Object} Phaser sprite object
   * @param {Position} target position
   */
  heroFireArrow: function(hero, targetPos) {
    // update weapon
    this.updateCreatureWeapon(hero);

    // set bullet animation
    // 2 bullet/sec (cause we have 7 frame per animation)
    hero.blr.weapon.animations.play('attack', 14, false, false);

    // fire
    var bullet = hero.blr.bullet.getFirstExists(false);
    bullet.reset(hero.blr.weapon.x, hero.blr.weapon.y);
    bullet.rotation = GAME.physics.arcade.moveToXY(
      bullet,
      targetPos.x,
      targetPos.y,
      hero.blr.misc.bulletSpeed
    );
  },

  playerMove: function() {
    // move
    GAME.physics.arcade.moveToPointer(this.player, this.player.blr.phrInfo.velocitySpeed);

    //  if it's overlapping the mouse, don't move any more
    if (Phaser.Rectangle.contains(this.player.body, GAME.input.x, GAME.input.y)) {
      this.player.body.velocity.setTo(0, 0);

    } else {
      // update body rotation
      this.updateCreatureRotationByFollowingMouse(this.player);

      // update info
      this.updateCreatureLastVector(this.player);

      // broadcast `move` event
      var data = {
        playerInfo: this.player.blr.info,
      };
      SOCKET.emit(EVENT_NAME.player.move, data);
    }
  },

  playerSendMessage: function() {
    var ts = UTIL.getCurrentUtcTimestamp();

    // if start typing
    if (!this.player.blr.misc.isTyping) {
      this.player.blr.updateLastEnterTimestamp(ts);
      this.player.blr.misc.isTyping = true;

      UI.enableMessageInput();

    } else {
      this.player.blr.updateLastEnterTimestamp(ts);
      this.player.blr.misc.isTyping = false;

      // update
      var message = UI.getMessageInput();
      if (message) {
        // set message
        this.player.blr.updateLastMessageTimestamp(ts);
        this.player.blr.info.lastMessage = message;
        this.player.blr.bubble.setText(message);
        this.player.blr.bubble.visible = true;

        // add message text to log
        this.logCreatureMessage(this.player);

        // broadcast `message` event
        var data = {
          playerInfo: this.player.blr.info,
        };
        SOCKET.emit(EVENT_NAME.player.message, data);
      }

      UI.disableMessageInput();
    }
  },

  /*================================================================ Socket
   */

  setSocketHandlers: function() {
    SOCKET.on(EVENT_NAME.server.newPlayer, this.onPlayerConnect.bind(this));
    SOCKET.on(EVENT_NAME.server.disconnectedPlayer, this.onPlayerDisconnect.bind(this));
    SOCKET.on(EVENT_NAME.player.message, this.onPlayerMessage.bind(this));
    SOCKET.on(EVENT_NAME.player.move, this.onPlayerMove.bind(this));
    SOCKET.on(EVENT_NAME.player.fire, this.onPlayerFire.bind(this));
    SOCKET.on(EVENT_NAME.player.isFired, this.onPlayerIsFired.bind(this));
    SOCKET.on(EVENT_NAME.player.isWelled, this.onPlayerIsWelled.bind(this));
    SOCKET.on(EVENT_NAME.player.isOverlappedByMonster, this.onPlayerIsOverlappedByMonster.bind(this));
    SOCKET.on(EVENT_NAME.player.isDied, this.onPlayerIsDied.bind(this));
  },

  onPlayerReady: function(data) {
    if (IS_DEBUG) UTIL.clientLog('Init data', data);
    var zombieInfos = data.zombieInfos,
      machineInfos = data.machineInfos,
      playerInfo = data.playerInfo,
      batInfos = data.batInfos,
      existingPlayerInfos = data.existingPlayerInfos;

    this.VTMap = data.VTMap;

    // draw VTMap to game
    if (IS_DEBUG) {
      this.debugMap();
    }

    // set miniMap
    this.setMiniMap();

    // monster - zombie
    var nZombies = zombieInfos.length;
    for (var i = 0; i < nZombies; i++) {
      this.spawnZombie(zombieInfos[i]);
    }

    // monster - machine
    var nMachines = machineInfos.length;
    for (var i = 0; i < nMachines; i++) {
      this.spawnMachine(machineInfos[i]);
    }

    // monster - bat
    var nBats = batInfos.length;
    for (var i = 0; i < nBats; i++) {
      this.spawnBat(batInfos[i]);
    }

    // hero - enemy
    var nEnemies = existingPlayerInfos.length;
    for (var i = 0; i < nEnemies; i++) {
      this.spawnEnemy(existingPlayerInfos[i]);
    }

    // hero - player
    this.spawnPlayer(playerInfo);

    // camera
    GAME.camera.follow(this.player);

    // reorder z-index (hack)
    // floor
    GAME.world.bringToTop(this.floorGroup);
    GAME.world.bringToTop(this.stoneShadowGroup);
    GAME.world.bringToTop(this.stoneGroup);
    GAME.world.bringToTop(this.vtmapDebugGroup);

    // emitter
    GAME.world.bringToTop(this.dashEmitterGroup);
    GAME.world.bringToTop(this.recoverEmitterGroup);
    GAME.world.bringToTop(this.damageEmitterGroup);

    // shadow
    GAME.world.bringToTop(this.monsterShadowGroup);
    GAME.world.bringToTop(this.heroShadowGroup);

    // monster
    GAME.world.bringToTop(this.zombieWeaponGroup);
    GAME.world.bringToTop(this.zombieGroup);
    GAME.world.bringToTop(this.machineGroup);
    GAME.world.bringToTop(this.machineWeaponGroup);
    GAME.world.bringToTop(this.batWeaponGroup);
    GAME.world.bringToTop(this.batGroup);

    // hero
    GAME.world.bringToTop(this.enemyWeaponGroup);
    GAME.world.bringToTop(this.enemyGroup);
    GAME.world.bringToTop(this.playerWeaponGroup);
    GAME.world.bringToTop(this.playerGroup);

    // bullet
    GAME.world.bringToTop(this.machineLaserGroup);
    GAME.world.bringToTop(this.enemyArrowGroup);
    GAME.world.bringToTop(this.playerArrowGroup);

    // sky
    GAME.world.bringToTop(this.treeGroup);
    GAME.world.bringToTop(this.miniMapBg);
    GAME.world.bringToTop(this.miniMapUnit);
    GAME.world.bringToTop(this.heroBubbleGroup);

    this.setSocketHandlers();
    this.isGameReady = true;
  },

  onPlayerConnect: function(data) {
    var playerInfo = data.playerInfo;
    UTIL.clientLog('New player is connected', playerInfo);
    this.logOnPlayerConnect(playerInfo);

    // enemy
    this.spawnEnemy(playerInfo);
  },

  onPlayerDisconnect: function(data) {
    var playerInfo = data.playerInfo;
    UTIL.clientLog('Player is disconnected', playerInfo);
    this.logOnPlayerDisconnect(playerInfo);

    // remove enemy
    var isFound = false;

    this.enemyGroup.forEach(function(enemy) {
      if (enemy.blr.info.id === playerInfo.id) {
        enemy.blr.bullet.destroy();
        enemy.blr.label.destroy();
        enemy.blr.bullet.destroy();
        enemy.blr.weapon.destroy();
        enemy.blr.shadow.destroy();
        enemy.destroy();

        // misc
        console.log('enemy ' + enemy.blr.info.id + ' is removed');
        isFound = true;
        UI.removeCreatureIdFromCreatureList(enemy.blr.info.id);
      }
    }, this);

    if (!isFound) {
      console.error('not found enemy ' + playerInfo.id, playerInfo);
    }
  },

  onPlayerMessage: function(data) {
    var playerInfo = data.playerInfo,
      enemy = this.getEnemyByPlayerId(playerInfo.id);

    if (!UTIL.isEmptyObject(enemy)) {
      this.forceUpdateEnemyFromSocketEvent(enemy, playerInfo.life, playerInfo.lastVector);
      
      enemy.blr.updateLastMessageTimestamp(playerInfo.lastMessageTimestamp);
      enemy.blr.info.lastMessage = playerInfo.lastMessage;
      enemy.blr.bubble.setText(playerInfo.lastMessage);
      enemy.blr.bubble.visible = true;
      this.logCreatureMessage(enemy);
    }
  },

  onPlayerMove: function(data) {
    var playerInfo = data.playerInfo,
      enemy = this.getEnemyByPlayerId(playerInfo.id);

    if (!UTIL.isEmptyObject(enemy)) {
      this.forceUpdateEnemyFromSocketEvent(enemy, playerInfo.life, playerInfo.lastVector);
    }
  },

  onPlayerFire: function(data) {
    var playerInfo = data.playerInfo,
      targetPos = data.targetPos,
      enemy = this.getEnemyByPlayerId(playerInfo.id);

    if (!UTIL.isEmptyObject(enemy)) {
      this.forceUpdateEnemyFromSocketEvent(enemy, playerInfo.life, playerInfo.lastVector);

      this.enemyFireArrow(enemy, targetPos);
    }
  },

  onPlayerIsFired: function(data) {
    var playerInfo = data.playerInfo,
      enemy = this.getEnemyByPlayerId(playerInfo.id);

    if (!UTIL.isEmptyObject(enemy)) {
      this.forceUpdateEnemyFromSocketEvent(enemy, playerInfo.life, playerInfo.lastVector);

      this.playDamageParticle(enemy);
      enemy.animations.play('blink', 10, false, false);
      this.logOnCreatureIsDamaged(enemy, 'fire');
    }
  },

  onPlayerIsWelled: function(data) {
    var playerInfo = data.playerInfo,
      enemy = this.getEnemyByPlayerId(playerInfo.id);

    if (!UTIL.isEmptyObject(enemy)) {
      this.forceUpdateEnemyFromSocketEvent(enemy, playerInfo.life, playerInfo.lastVector);

      this.playRecoverParticle(enemy);
      enemy.animations.play('recover', 10, false, false);
      this.logOnCreatureIsRecovered(enemy, 'well');
    }
  },

  onPlayerIsOverlappedByMonster: function(data) {
    var playerInfo = data.playerInfo,
      damageFrom = data.damageFrom,
      enemy = this.getEnemyByPlayerId(playerInfo.id);

    if (!UTIL.isEmptyObject(enemy)) {
      this.forceUpdateEnemyFromSocketEvent(enemy, playerInfo.life, playerInfo.lastVector);

      this.playDamageParticle(enemy);
      enemy.animations.play('blink', 10, false, false);
      this.logOnCreatureIsDamaged(enemy, damageFrom);
    }
  },

  onPlayerIsDied: function(data) {
    var playerInfo = data.playerInfo,
      damageFrom = data.damageFrom,
      enemy = this.getEnemyByPlayerId(playerInfo.id);

    if (!UTIL.isEmptyObject(enemy)) {
      this.forceUpdateEnemyFromSocketEvent(enemy, playerInfo.life, playerInfo.lastVector);

      enemy.blr.shadow.kill();
      enemy.blr.weapon.kill();
      enemy.kill();
      this.logOnCreatureIsDied(enemy, damageFrom);
    }
  },

  /**
   * This function will force update
   * (it's used every time when receive enemy event data from socket event
   * except `ready`, `connect`, `disconnect` event)
   * - life
   * - body x
   * - body y
   * - body rotation
   * 
   * @param {Phaser.Sprite} enemy that contain `Creature` object in `blr` property
   * @param {number} life
   * @param {Vector} lastVector
   */
  forceUpdateEnemyFromSocketEvent: function(enemy, life, lastVector) {
    enemy.blr.info.life = life;
    enemy.x = lastVector.x;
    enemy.y = lastVector.y;
    enemy.rotation = lastVector.rotation;
  },

  /*================================================================ Stage
   */

  preload: function() {

  },

  init: function() {

    // floor
    this.floorGroup = GAME.add.group();
    this.stoneShadowGroup = GAME.add.group();
    this.stoneGroup = GAME.add.group();
    this.vtmapDebugGroup = GAME.add.group();

    // monster
    this.monsterShadowGroup = GAME.add.group();
    this.zombieWeaponGroup = GAME.add.group();
    this.zombieGroup = GAME.add.group();
    this.machineWeaponGroup = GAME.add.group();
    this.machineGroup = GAME.add.group();
    this.batWeaponGroup = GAME.add.group();
    this.batGroup = GAME.add.group();

    // hero
    this.heroShadowGroup = GAME.add.group();
    this.enemyWeaponGroup = GAME.add.group();
    this.enemyGroup = GAME.add.group();
    this.playerWeaponGroup = GAME.add.group();
    this.playerGroup = GAME.add.group();

    // bullet
    this.machineLaserGroup = GAME.add.group();
    this.enemyArrowGroup = GAME.add.group();
    this.playerArrowGroup = GAME.add.group();

    // sky
    this.treeGroup = GAME.add.group();
    this.miniMapBg = GAME.add.group();
    this.miniMapUnit = GAME.add.group();
    this.heroBubbleGroup = GAME.add.group();

    // disable default right-click's behavior on the canvas
    GAME.canvas.oncontextmenu = function(e) {
      e.preventDefault()
    };

    // misc
    GAME.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
    GAME.scale.pageAlignHorizontally = true;
    GAME.scale.pageAlignVertically = true;
    GAME.input.mouse.capture = true;
    GAME.stage.disableVisibilityChange = true;
    GAME.scale.setResizeCallback(function() {
      GAME.scale.setGameSize(window.innerWidth, window.innerHeight);
    });

    // socket
    SOCKET.on('connect', function() {
      UTIL.clientLog('Connected to server');
    });

    SOCKET.on('disconnect', function() {
      UTIL.clientLog('Disconnected from ' + SOCKET_URL);
    });

    // player is ready
    SOCKET.on(EVENT_NAME.player.ready, this.onPlayerReady.bind(this));
  },

  create: function() {
    GAME.time.advancedTiming = true;

    // world
    GAME.world.setBounds(0, 0, GAME_WORLD_WIDTH, GAME_WORLD_HEIGHT);

    // system & world
    GAME.physics.startSystem(Phaser.Physics.ARCADE);

    // bg
    GAME.stage.backgroundColor = '#3db148';

    // map - floor
    var map = GAME.add.tilemap('mapTile');
    map.addTilesetImage('map');
    this.floorGroup = map.createLayer(0);
    this.floorGroup.resizeWorld();
    map.setTileIndexCallback(5, this.onCreatureOverlapWell, this, this.floorGroup);
    map.setTileIndexCallback(6, this.onCreatureOverlapFire, this, this.floorGroup);

    // map - stone (rock, bush)
    this.stoneGroup = map.createLayer(1);
    map.setCollision([1, 3], true, this.stoneGroup);
    map.forEach(function(tile) {
      if (tile.index === 1 || tile.index === 3) {
        var stoneShadow = GAME.add.sprite(tile.worldX, tile.worldY, 'shadow');
        stoneShadow.scale.setTo(0.7, 0.7);
        stoneShadow.alpha = .3;
        this.stoneShadowGroup.add(stoneShadow);
      }
    }, this, 0, 0, 50, 50, this.stoneGroup);

    // map - tree
    this.treeGroup = map.createLayer(2);

    // keyboard
    this.spaceKey = GAME.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    this.enterKey = GAME.input.keyboard.addKey(Phaser.Keyboard.ENTER);

    // emitter
    this.setDashEmitter();
    this.setRecoverEmitter();
    this.setDamageEmitter();

    // player ready
    SOCKET.emit(EVENT_NAME.player.ready, null);
  },

  update: function() {
    if (this.isGameReady) {
      var ts = UTIL.getCurrentUtcTimestamp();

      // collide - creature with floorGroup
      GAME.physics.arcade.collide(this.zombieGroup, this.floorGroup);
      GAME.physics.arcade.collide(this.machineGroup, this.floorGroup);
      GAME.physics.arcade.collide(this.batGroup, this.floorGroup);
      GAME.physics.arcade.collide(this.playerGroup, this.floorGroup);

      // collide - creature with stoneGroup
      GAME.physics.arcade.collide(this.zombieGroup, this.stoneGroup, this.onMonsterCollideStoneGroup, null, this);
      GAME.physics.arcade.collide(this.machineGroup, this.stoneGroup, this.onMonsterCollideStoneGroup, null, this);
      GAME.physics.arcade.collide(this.batGroup, this.stoneGroup, this.onMonsterCollideStoneGroup, null, this);
      GAME.physics.arcade.collide(this.playerGroup, this.stoneGroup, this.onPlayerCollideStoneGroup, null, this);

      // collide - player with monster
      GAME.physics.arcade.collide(this.playerGroup, this.zombieGroup, this.onPlayerCollideMonster, null, this);
      GAME.physics.arcade.collide(this.playerGroup, this.machineGroup, this.onPlayerCollideMonster, null, this);
      GAME.physics.arcade.collide(this.playerGroup, this.batGroup, this.onPlayerCollideMonster, null, this);

      // overlap - player with monster
      GAME.physics.arcade.overlap(this.playerGroup, this.zombieGroup, this.onPlayerOverlapZombie, null, this);
      GAME.physics.arcade.overlap(this.playerGroup, this.machineGroup, this.onPlayerOverlapMachine, null, this);
      GAME.physics.arcade.overlap(this.playerGroup, this.batGroup, this.onPlayerOverlapBat, null, this);

      // overlap - player with monster weapon
      GAME.physics.arcade.overlap(this.playerGroup, this.zombieWeaponGroup, this.onPlayerOverlapZombieWeapon, null, this);
      GAME.physics.arcade.overlap(this.playerGroup, this.machineWeaponGroup, this.onPlayerOverlapMachineWeapon, null, this);
      GAME.physics.arcade.overlap(this.playerGroup, this.batWeaponGroup, this.onPlayerOverlapBatWeapon, null, this);

      // overlap - player arrow with monster
      GAME.physics.arcade.overlap(this.playerArrowGroup, this.zombieGroup, this.onPlayerArrowOverlapMonster, null, this);
      GAME.physics.arcade.overlap(this.playerArrowGroup, this.machineGroup, this.onPlayerArrowOverlapMonster, null, this);
      GAME.physics.arcade.overlap(this.playerArrowGroup, this.batGroup, this.onPlayerArrowOverlapMonster, null, this);

      // overlap - machine laser overlap player
      GAME.physics.arcade.overlap(this.machineLaserGroup, this.playerGroup, this.onMachineLaserOverlapPlayer, null, this);

      // reset emiiter
      this.fadeAllEmitters();

      // reset - bubble - player
      this.updateCreatureBubbleVisibility(this.player);

      // reset - bubble - enemy
      this.enemyGroup.forEach(function(creature) {
        this.updateCreatureBubbleVisibility(creature);
      }, this);

      // player
      if (this.player.alive) {

        // reset
        this.player.body.velocity.x = 0;
        this.player.body.velocity.y = 0;
        this.player.body.angularVelocity = 0;

        // input - left click
        if (GAME.input.activePointer.leftButton.isDown) {
          this.playerMove();
        }

        // input -  right click || spacebar
        if (GAME.input.activePointer.rightButton.isDown || this.spaceKey.isDown) {
          // fire arrow
          this.playerFireArrow(this.player);
        }

        // message
        // 200 is key pressing delay 
        if (this.enterKey.isDown && ts - this.player.blr.misc.lastEnterTimestamp > this.enterKeyDelay) {
          this.playerSendMessage();
        }
      }

      /*
      // monster - zombie
      this.zombieGroup.forEachAlive(function(monster) {
        if (monster.alive) {
          // reset
          monster.body.velocity.y = 0;
          monster.body.velocity.x = 0;
          monster.body.angularVelocity = 0;

          // autoMove
          this.monsterAutoMove(monster);
        }
      }, this);

      // monster - machine
      this.machineGroup.forEachAlive(function(monster) {
        if (monster.alive) {
          // reset
          monster.body.velocity.y = 0;
          monster.body.velocity.x = 0;
          monster.body.angularVelocity = 0;

          // bullet
          if (!IS_INVISIBLE && GAME.physics.arcade.distanceBetween(monster, this.player) < monster.blr.misc.visibleRange) {
            if (ts > monster.blr.misc.nextFireTimestamp &&
              monster.blr.bullet.countDead() > 0) {
              monster.blr.misc.nextFireTimestamp = UTIL.getCurrentUtcTimestamp() + monster.blr.misc.fireRate;

              var bullet = monster.blr.bullet.getFirstDead();
              bullet.reset(monster.blr.weapon.x, monster.blr.weapon.y);
              bullet.rotation = GAME.physics.arcade.moveToObject(bullet, this.player, monster.blr.misc.bulletSpeed);
            }
          }
        }
      }, this);

      // monster - bat
      this.batGroup.forEachAlive(function(monster) {
        if (monster.alive) {
          // reset
          monster.body.velocity.y = 0;
          monster.body.velocity.x = 0;
          monster.body.angularVelocity = 0;

          // autoMove
          this.monsterAutoMove(monster);
        }
      }, this);
      */

      this.updateMinimap();
    }
  },

  preRender: function() {
    // All `sub`(s) should be here
    // - weapon
    // - shadow
    // - particle
    // - label (just update text, cause it's child)
    // - bubble 

    if (this.isGameReady) {
      // hero - player
      if (this.player.alive) {
        if (this.isCreatureMove(this.player)) {
          this.updateCreatureWeapon(this.player);
          this.updateCreatureShadow(this.player);
          this.playDashParticle(this.player);
        }
        this.updateCreatureLabelText(this.player);
        this.updateCreatureBubble(this.player);
      }

      // hero - enemy
      this.enemyGroup.forEachAlive(function(hero) {
        if (this.isCreatureMove(hero)) {
          this.updateCreatureWeapon(hero);
          this.updateCreatureShadow(hero);
          this.playDashParticle(hero);
        }
        this.updateCreatureLabelText(hero);
        this.updateCreatureBubble(hero);
      }, this);

      // monster - zombie
      this.zombieGroup.forEachAlive(function(monster) {
        if (this.isCreatureMove(monster)) {
          this.updateCreatureWeapon(monster);
          this.updateCreatureShadow(monster);
        }
        this.updateCreatureLabelText(monster);
      }, this);

      // monster - machine
      this.machineGroup.forEachAlive(function(monster) {
        var newX = monster.x,
          newY = monster.y,
          newRotation = GAME.physics.arcade.angleBetween(monster, this.player);

        // this monster can not move
        this.updateCreatureWeapon(monster, newX, newY, newRotation);
        this.updateCreatureLabelText(monster);
      }, this);

      // monster - bat
      this.batGroup.forEachAlive(function(monster) {
        if (this.isCreatureMove(monster)) {
          this.updateCreatureWeapon(monster);
          this.updateCreatureShadow(monster);
        }
        this.updateCreatureLabelText(monster);
      }, this);
    }
  },

  render: function() {
    if (this.isGameReady && IS_DEBUG) {
      var creatureBodyDebugColor = 'rgba(0,255, 0, 0.4)',
        weaponBodyDebugColor = 'rgba(215, 125, 125, 0.4)';

      // top
      GAME.debug.bodyInfo(this.player, 264, 18);
      GAME.debug.spriteInfo(this.player, 264, 120);

      // middle
      GAME.debug.start(6, 276);
      GAME.debug.line('Frames per second (FPS) ' + GAME.time.fps);
      GAME.debug.line('zombieGroup living ' + this.zombieGroup.countLiving());
      GAME.debug.line('zombieGroup dead ' + this.zombieGroup.countDead());
      GAME.debug.line('machineGroup living ' + this.machineGroup.countLiving());
      GAME.debug.line('machineGroup dead ' + this.machineGroup.countDead());
      GAME.debug.line('batGroup living ' + this.batGroup.countLiving());
      GAME.debug.line('batGroup dead ' + this.batGroup.countDead());
      GAME.debug.stop();

      // weapon body
      GAME.debug.body(this.player.blr.weapon, creatureBodyDebugColor);

      this.zombieWeaponGroup.forEachAlive(function(weapon) {
        GAME.debug.body(weapon, weaponBodyDebugColor);
      }, this);

      this.machineWeaponGroup.forEachAlive(function(weapon) {
        GAME.debug.body(weapon, weaponBodyDebugColor);
      }, this);

      this.batWeaponGroup.forEachAlive(function(weapon) {
        GAME.debug.body(weapon, weaponBodyDebugColor);
      }, this);

      // creature body
      GAME.debug.body(this.player, creatureBodyDebugColor);

      this.zombieGroup.forEachAlive(function(monster) {
        GAME.debug.body(monster, creatureBodyDebugColor);
      }, this);

      this.machineGroup.forEachAlive(function(monster) {
        GAME.debug.body(monster, creatureBodyDebugColor);
      }, this);

      this.batGroup.forEachAlive(function(monster) {
        GAME.debug.body(monster, creatureBodyDebugColor);
      }, this);
    }
  }
};

module.exports = Play;

(function () {
    'use strict';

    /**
     * Game runner
     * @param {string} outerContainerId The containing element id
     * @param {Object} config Optionally, the configuration object
     */
    function Runner(outerContainerId, opt_config) {
        // Singleton
        if (Runner.instance_) {
            return Runner.instance_;
        }
        Runner.instance_ = this;

        this.outerContainerEl = document.querySelector(outerContainerId);
        this.containerEl = null;

        this.canvas = null;
        this.canvasCtx = null;

        this.config = opt_config || Runner.config;

        // Is the game currently running?
        this.playing = false;
        this.gameOver = false;
        this.youWin = false;

        this.dimensions = Runner.defaultDimensions;

        // Time related elements
        this.time = 0;
        this.runningTime = 0;

        // Screen elements
        this.ball = null;
        this.paddle = null;
        this.squares = [];
        this.walls = [];
        this.activeSquares = 0;
        this.puffin = null;
        this.panda = null;
        this.bunny = null;

        this.init();
    }

    // Hacky export
    window['Runner'] = Runner;

    Runner.config = {
        BALL_RADIUS: 10,
        BALL_START_VX: 5,
        BALL_START_VY: -5,

        PADDLE_WIDTH: 100,
        PADDLE_TOP_Y: 580,
        PADDLE_BOTTOM_Y: 600,
        PADDLE_STEP: 10,
        PADDLE_ANGLE: 90,

        SQUARE_SIDE: 40,
        NUM_SQUARE_ROWS: 6,
        SQUARE_PADDING: 2,
        SQUARE_TOP_Y: 80,

        BUNNY_PANDA_PADDING: 5,
        BUNNY_PANDA_WIDTH: 50,

        WALL_WIDTH: 20,
    }

    /**
     * Default dimensions
     *
     * @enum {number}
     */
    Runner.defaultDimensions = {
        WIDTH: 500,
        HEIGHT: 650,

        CANVAS_WIDTH: 500,
        CANVAS_HEIGHT: 650 + 100
    }

    /**
     * CSS class names
     *
     * @enum {string}
     */
    Runner.classes = {
        CANVAS: 'runner-canvas',
        CONTAINER: 'runner-container'
    };

    /**
     * Key code mapping.
     *
     * @enum {Object}
     */
    Runner.keycodes = {
        PADDLE_LEFT: { '37': 1 }, // Left
        PADDLE_RIGHT: { '39': 1 },  // Right
        RESTART: { '13': 1, '32': 1 }  // Enter, Space
    };

    /**
     * Runner event names.
     * @enum {string}
     */
    Runner.events = {
        KEYDOWN: 'keydown',
        KEYUP: 'keyup',
    };

    Runner.prototype = {

        /**
         * Game initializer
         */
        init: function () {
            this.containerEl = document.createElement('div');
            this.containerEl.className = Runner.classes.CONTAINER;

            this.canvas = createCanvas(
                this.containerEl,
                this.dimensions.CANVAS_WIDTH,
                this.dimensions.CANVAS_HEIGHT,
                Runner.classes.PLAYER
            );

            this.canvasCtx = this.canvas.getContext('2d');
            this.canvasCtx.fillStyle = '#f7f7f7';
            this.canvasCtx.fill();

            this.restart();

            this.outerContainerEl.appendChild(this.containerEl);

            this.startListening();
            this.update();
        },

        /**
         * Draw all the necessary elements of the game
         */
        restart: function () {
            // Draw the ball
            this.ball = new Ball(this.canvas, this.dimensions.WIDTH * 1 / 4, this.dimensions.HEIGHT * 3 / 4, this.config.BALL_START_VX, this.config.BALL_START_VY, this.config.BALL_RADIUS);

            // Draw the paddle
            this.paddle = new Rectangle(
                this.canvas,
                (this.dimensions.WIDTH - this.config.PADDLE_WIDTH) / 2,
                this.config.PADDLE_TOP_Y,
                (this.dimensions.WIDTH + this.config.PADDLE_WIDTH) / 2,
                this.config.PADDLE_BOTTOM_Y,
                0, 0, 0, 1
            );

            // Draw the walls
            this.walls = [
                // Top wall
                new Rectangle(this.canvas, 0, 0, this.dimensions.WIDTH, this.config.WALL_WIDTH, 0, 0, 180, 0),

                // Right wall
                new Rectangle(this.canvas, this.dimensions.WIDTH - this.config.WALL_WIDTH, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT, 0, 0, 180, 0),

                // Bottom wall
                new Rectangle(this.canvas, 0, this.dimensions.HEIGHT - this.config.WALL_WIDTH, this.dimensions.WIDTH, this.dimensions.HEIGHT, 0, 0, 180, 0),

                // Left wall
                new Rectangle(this.canvas, 0, 0, this.config.WALL_WIDTH, this.dimensions.HEIGHT, 0, 0, 180, 0)
            ];

            // Compute square data
            var totalPossibleSquareWidth = this.dimensions.WIDTH - 2 * this.config.WALL_WIDTH - 8 * this.config.BALL_RADIUS - 20;
            var numSquareColumns = parseInt(totalPossibleSquareWidth / this.config.SQUARE_SIDE);
            var totalSquareWidth = numSquareColumns * this.config.SQUARE_SIDE;
            var squaresLeftX = parseInt(this.dimensions.WIDTH / 2 - totalSquareWidth / 2);
            this.squares = [];
            for (var i = 0; i < numSquareColumns; ++i) {
                for (var j = 0; j < this.config.NUM_SQUARE_ROWS; ++j) {
                    this.squares.push(
                        new Rectangle(
                            this.canvas,
                            squaresLeftX + i * this.config.SQUARE_SIDE + this.config.SQUARE_PADDING,
                            this.config.SQUARE_TOP_Y + j * this.config.SQUARE_SIDE + this.config.SQUARE_PADDING,
                            squaresLeftX + (i + 1) * this.config.SQUARE_SIDE - this.config.SQUARE_PADDING,
                            this.config.SQUARE_TOP_Y + (j + 1) * this.config.SQUARE_SIDE - this.config.SQUARE_PADDING,
                            0, 0,
                            Math.random() * 360
                        )
                    );
                    this.squares[this.squares.length - 1].opacity = 0.8;
                }
            }
            this.activeSquares = this.squares.length;

            this.puffin = new Text(
                this.canvas,
                '🐧',
                this.dimensions.WIDTH / 2,
                this.config.SQUARE_TOP_Y + this.config.SQUARE_SIDE,
                (this.config.NUM_SQUARE_ROWS - 1) * this.config.SQUARE_SIDE
            );

            this.panda = new Text(
                this.canvas,
                '🐼',
                this.dimensions.WIDTH / 2 - this.config.BUNNY_PANDA_WIDTH / 2 - this.config.BUNNY_PANDA_PADDING,
                this.dimensions.HEIGHT + 3 * this.config.BUNNY_PANDA_PADDING,
                this.config.BUNNY_PANDA_WIDTH,
                1
            );

            this.bunny = new Text(
                this.canvas,
                '🐰',
                this.dimensions.WIDTH / 2 + this.config.BUNNY_PANDA_WIDTH / 2 + this.config.BUNNY_PANDA_PADDING,
                this.dimensions.HEIGHT + 3 * this.config.BUNNY_PANDA_PADDING,
                this.config.BUNNY_PANDA_WIDTH,
                1
            );

            this.leftSweat = new Text(
                this.canvas,
                '💦',
                this.dimensions.WIDTH / 2 - this.config.BUNNY_PANDA_PADDING - this.config.BUNNY_PANDA_WIDTH - this.config.BUNNY_PANDA_PADDING - this.config.BUNNY_PANDA_WIDTH / 2,
                this.dimensions.HEIGHT + 3 * this.config.BUNNY_PANDA_PADDING,
                this.config.BUNNY_PANDA_WIDTH,
                1,
                0,
                false,
                true
            );

            this.rightSweat = new Text(
                this.canvas,
                '💦',
                this.dimensions.WIDTH / 2 + this.config.BUNNY_PANDA_PADDING + this.config.BUNNY_PANDA_WIDTH + this.config.BUNNY_PANDA_PADDING + this.config.BUNNY_PANDA_WIDTH / 2,
                this.dimensions.HEIGHT + 3 * this.config.BUNNY_PANDA_PADDING,
                this.config.BUNNY_PANDA_WIDTH,
                1,
                0,
                false
            );

            this.leftHeart = new Ball(this.canvas, this.dimensions.WIDTH / 5 * 2, this.dimensions.CANVAS_HEIGHT / 5 * 2.25, 0, 0, this.dimensions.WIDTH / 7);
            this.leftHeart.opacity = 0;
            this.rightHeart = new Ball(this.canvas, this.dimensions.WIDTH / 5 * 4, this.dimensions.CANVAS_HEIGHT / 5 * 3.5, 0, 0, this.dimensions.WIDTH / 7);
            this.rightHeart.opacity = 0;
        },

        /**
         * Event handler.
         */
        handleEvent: function (e) {
            return (function (evtType, events) {
                switch (evtType) {
                    case events.KEYDOWN:
                        this.onKeyDown(e);
                        break;

                    case events.KEYUP:
                        this.onKeyUp(e);
                        break;
                }
            }.bind(this))(e.type, Runner.events);
        },

        /**
         * Setup event handling
         */
        startListening: function () {
            document.addEventListener(Runner.events.KEYDOWN, this);
            document.addEventListener(Runner.events.KEYUP, this);
        },

        /**
         * Process a keyDown event
         *
         * @param {Event} e The event to handle
         */
        onKeyDown: function (e) {
            if (!this.playing && Runner.keycodes.RESTART[e.keyCode]) {
                this.playing = true;
                if (this.gameOver || this.youWin) {
                    this.gameOver = false;
                    this.youWin = false;
                    this.restart();
                }
                this.update();
            }

            if (this.playing) {
                if (Runner.keycodes.PADDLE_LEFT[e.keyCode]) {
                    this.paddle.vx = -this.config.PADDLE_STEP;
                    this.bunny.angle = -22.5;
                    this.panda.angle = -22.5;
                    this.leftSweat.isActive = true;
                    this.rightSweat.isActive = false;
                } else if (Runner.keycodes.PADDLE_RIGHT[e.keyCode]) {
                    this.paddle.vx = this.config.PADDLE_STEP;
                    this.bunny.angle = 22.5;
                    this.panda.angle = 22.5;
                    this.leftSweat.isActive = false;
                    this.rightSweat.isActive = true;
                }
            }
        },

        onKeyUp: function (e) {
            if (this.playing) {
                if (
                    (Runner.keycodes.PADDLE_LEFT[e.keyCode] && this.paddle.vx <= 0) ||
                    (Runner.keycodes.PADDLE_RIGHT[e.keyCode] && this.paddle.vx >= 0)
                ) {
                        this.paddle.vx = 0;
                        this.bunny.angle = 0;
                        this.panda.angle = 0;
                        this.leftSweat.isActive = false;
                        this.rightSweat.isActive = false;
                }
            }
        },

        clearCanvas: function () {
            this.canvasCtx.clearRect(0, 0, this.dimensions.CANVAS_WIDTH, this.dimensions.CANVAS_HEIGHT);
        },

        /**
         * Update the game frame and schedules the next one.
         */
        update: function () {

            this.updatePending = false;

            this.clearCanvas();

            var now = getTimeStamp();
            var deltaTime = now - (this.time || now);
            this.time = now;

            if (this.playing) {
                this.runningTime += deltaTime;

                // Check for collissions. Note that this can end the game
                // and so there's a separate this.playing conditional below

                // Has the ball hit the paddle?
                {
                    switch (this.ball.collideRect(this.paddle)) {
                        case Ball.collideSides.TOP:
                            var percentAlong = Math.max(0, Math.min(1, (this.ball.x - this.paddle.leftX) / this.config.PADDLE_WIDTH));
                            this.ball.vx = this.ball.speed * Math.sin((percentAlong - 0.5) * this.config.PADDLE_ANGLE * Math.PI / 180);
                            this.ball.vy = -this.ball.speed * Math.cos((percentAlong - 0.5) * this.config.PADDLE_ANGLE * Math.PI / 180);

                            break;

                        case Ball.collideSides.BOTTOM:
                            this.ball.vy = Math.abs(this.ball.vy);
                            break;

                        case Ball.collideSides.LEFT:
                            this.ball.vx = -Math.abs(this.ball.vx);
                            break;

                        case Ball.collideSides.RIGHT:
                            this.ball.vx = Math.abs(this.ball.vx);
                            break;
                    }
                }

                // Has the ball hit a square?
                for (var i = 0; i < this.squares.length; ++i) {
                    if (this.squares[i].isActive) {
                        var collideSide = this.ball.collideRect(this.squares[i]);
                        switch (collideSide) {
                            case Ball.collideSides.TOP:
                                this.ball.vy = -Math.abs(this.ball.vy);
                                break;

                            case Ball.collideSides.BOTTOM:
                                this.ball.vy = Math.abs(this.ball.vy);
                                break;

                            case Ball.collideSides.LEFT:
                                this.ball.vx = -Math.abs(this.ball.vx);
                                break;

                            case Ball.collideSides.RIGHT:
                                this.ball.vx = Math.abs(this.ball.vx);
                                break;
                        }

                        if (collideSide !== Ball.collideSides.NONE) {
                            this.squares[i].isActive = false;
                            this.activeSquares -= 1;
                        }
                    }
                }

                // Has the ball hit a wall?
                for (var i = 0; i < this.walls.length; ++i) {
                    switch (this.ball.collideRect(this.walls[i])) {
                        case Ball.collideSides.TOP:
                            this.ball.vy = -Math.abs(this.ball.vy);

                            // In this case, you've hit the bottom wall
                            this.gameOver = true;
                            this.playing = false;
                            break;

                        case Ball.collideSides.BOTTOM:
                            this.ball.vy = Math.abs(this.ball.vy);
                            break;

                        case Ball.collideSides.LEFT:
                            this.ball.vx = -Math.abs(this.ball.vx);
                            break;

                        case Ball.collideSides.RIGHT:
                            this.ball.vx = Math.abs(this.ball.vx);
                            break;
                    }
                }

                // Has the paddle gone off the side?
                if (this.paddle.leftX < this.config.WALL_WIDTH) {
                    this.paddle.leftX = this.config.WALL_WIDTH + 1;
                    this.paddle.rightX = this.paddle.leftX + this.config.PADDLE_WIDTH;
                    this.paddle.vx = 0;
                } else if (this.paddle.rightX > this.dimensions.WIDTH - this.config.WALL_WIDTH) {
                    this.paddle.rightX = this.dimensions.WIDTH - this.config.WALL_WIDTH - 1;
                    this.paddle.leftX = this.paddle.rightX - this.config.PADDLE_WIDTH;
                    this.paddle.vx = 0;
                }

                // Update the elements
                this.puffin.update(this.activeSquares, this.squares.length);
                this.ball.update(this.runningTime);
                this.squares.map(elt => elt.update());
                this.walls.map(elt => elt.update());
                this.paddle.update();
                this.panda.update(0, 1);
                this.bunny.update(0, 1);
                this.leftSweat.update(0, 1);
                this.rightSweat.update(0, 1);

                if (this.activeSquares === 0) {
                    // You win!
                    this.youWin = true;
                    this.runningTime = 0;
                    this.playing = false;
                    document.getElementById('orig-title').classList.add('fadeOut');
                    document.getElementById('new-title').classList.add('fadeIn');
                }

            } else if (this.youWin) {

                this.runningTime += deltaTime;

                var easeFromZero = quadEase(this.runningTime / 2000);
                var easeFromOne = 1 - easeFromZero;

                this.clearCanvas();

                // Turn off sweat
                this.leftSweat.isActive = false;
                this.rightSweat.isActive = false;

                // Fade out world
                this.walls.map(elt => elt.opacity = easeFromOne);
                this.paddle.opacity = easeFromOne;
                this.ball.opacity = easeFromOne;

                var finalTextHeight = this.dimensions.CANVAS_HEIGHT / 7;

                // Get panda to top left
                this.panda.angle = 0;
                this.panda.xPos = easeFromZero * (finalTextHeight / 2 + 75) + easeFromOne * (this.dimensions.WIDTH / 2 - this.config.BUNNY_PANDA_WIDTH / 2 - this.config.BUNNY_PANDA_PADDING);
                this.panda.yPos = easeFromZero * 125 + easeFromOne * (this.dimensions.HEIGHT + 3 * this.config.BUNNY_PANDA_PADDING);
                this.panda.height = easeFromZero * finalTextHeight + easeFromOne * this.config.BUNNY_PANDA_WIDTH;

                this.bunny.angle = 0;
                this.bunny.xPos = easeFromZero * (this.dimensions.WIDTH - 50) + easeFromOne * (this.dimensions.WIDTH / 2 - this.config.BUNNY_PANDA_WIDTH / 2 - this.config.BUNNY_PANDA_PADDING);
                this.bunny.yPos = easeFromZero * (this.dimensions.CANVAS_HEIGHT - finalTextHeight - 90) + easeFromOne * (this.dimensions.HEIGHT + 3 * this.config.BUNNY_PANDA_PADDING);
                this.bunny.height = easeFromZero * finalTextHeight + easeFromOne * this.config.BUNNY_PANDA_WIDTH;

                this.puffin.xPos = easeFromZero * (this.dimensions.WIDTH / 2 + 20) + easeFromOne * this.dimensions.WIDTH / 2;
                this.puffin.yPos = easeFromZero * (this.dimensions.CANVAS_HEIGHT / 2 - 30) + easeFromOne * (this.config.SQUARE_TOP_Y + this.config.SQUARE_SIDE);
                this.puffin.height = easeFromZero * finalTextHeight + easeFromOne * (this.config.NUM_SQUARE_ROWS - 1) * this.config.SQUARE_SIDE;

                this.leftHeart.opacity = easeFromZero;
                this.rightHeart.opacity = easeFromZero;

                // Now have fun with some bobbing back and forth
                var delayTime = this.runningTime - 2000;
                this.panda.angle = quadEaseAngle(delayTime, 3500, 0, -22.5);
                this.bunny.angle = quadEaseAngle(delayTime, 5000, 0, -22.5);
                this.puffin.angle = quadEaseAngle(delayTime, 2000, 0, -22.5);
                this.leftHeart.angle = quadEaseAngle(delayTime, 4000, -90, 22.5);
                this.rightHeart.angle = quadEaseAngle(delayTime, 5250, -90, 22.5);

                this.ball.draw();
                this.leftHeart.draw();
                this.rightHeart.draw();
                this.paddle.draw();
                this.walls.map(elt => elt.draw());
                this.puffin.draw();
                this.panda.draw();
                this.bunny.draw();

            } else {
                // Update the elements
                this.puffin.update(this.activeSquares, this.squares.length);
                this.ball.update(this.runningTime);
                this.squares.map(elt => elt.update());
                this.walls.map(elt => elt.update());
                this.paddle.update();
                this.panda.update(0, 1);
                this.bunny.update(0, 1);
                this.leftSweat.update(0, 1);
                this.rightSweat.update(0, 1);
            }

            if (this.playing || this.youWin) {
                this.scheduleNextUpdate();
            } else {
                this.canvasCtx.save();

                // Draw instructions text
                this.canvasCtx.font = '48pt serif'
                this.canvasCtx.textAlign = 'center'
                this.canvasCtx.fillStyle = 'black'
                this.canvasCtx.fillText('Press space to start', this.dimensions.WIDTH / 2, this.dimensions.HEIGHT / 3 * 2, this.dimensions.WIDTH - 2 * this.config.WALL_WIDTH - 20);
                if (this.gameOver) {
                    // Draw Game Over dialog
                    this.canvasCtx.font = '48pt serif'
                    this.canvasCtx.textAlign = 'center'
                    this.canvasCtx.fillStyle = 'black'
                    this.canvasCtx.fillText('Game over', this.dimensions.WIDTH / 2, this.dimensions.HEIGHT / 3 * 2 - 72);
                }

                this.canvasCtx.restore();
            }
        },

        /**
         * RequestAnimationFrame wrapper.
         */
        scheduleNextUpdate: function () {
            if (!this.updatePending) {
                this.updatePending = true;
                this.raqId = requestAnimationFrame(this.update.bind(this));
            }
        },
    }

    /**
     * The ball element of our game. Just a circle :-)
     *
     * @param {HTMLDomElement} canvas
     * @param {number} startX
     * @param {number} startY
     * @param {number} startVx
     * @param {number} startVy
     * @param {number} opt_radius
     */
    function Ball(canvas, startX, startY, startVx, startVy, opt_radius) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');

        this.x = startX;
        this.y = startY;

        this.vx = startVx;
        this.vy = startVy;

        this.speed = null;

        this.opacity = 1;

        this.angle = -90;
        this.color = hslToRgb(0, 1, 0.5);

        this.radius = opt_radius || Ball.defaultDimensions.RADIUS;

        this.init();
    }

    /**
     * Default dimensions
     *
     * @enum {number}
     */
    Ball.defaultDimensions = {
        RADIUS: 10
    }

    /**
     * Possible return values of collide
     *
     * @enum {number}
     */
    Ball.collideSides = {
        NONE: 0,
        TOP: 1,
        RIGHT: 2,
        DOWN: 3,
        LEFT: 4
    }

    Ball.prototype = {

        /**
         * Initialize the ball object
        */
        init: function() {
            this.speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        },

        /**
         * Detect if the ball (as a circle) has collided with a rectangle.
         * Some notes:
         *   * If the circle comes in via the corner, this will prefer to collide
         *     with the top or bottom, not the left or right
         *   * If the center has already _entered_ the rectangle, then no collision
         *     occurs. Thus, N.B., keep your velocity less than your radius
         *
         * @param {Rectangle} rect The rectangle to check for a collision with
         * @returns {Ball.collideSides}
         */
        collideRect: function (rect) {
            if (!rect.isActive) {
                return Ball.collideSides.NONE;
            }
            var testX = this.x;
            var testY = this.y;
            var retval = Ball.collideSides.NONE;

            if (this.x < rect.leftX) {
                testX = rect.leftX;
                retval = Ball.collideSides.LEFT;
            } else if (this.x > rect.rightX) {
                testX = rect.rightX;
                retval = Ball.collideSides.RIGHT;
            } else {
                // The x component of distance is 0
            }

            if (this.y < rect.topY) {
                testY = rect.topY;
                retval = Ball.collideSides.TOP;
            } else if (this.y > rect.bottomY) {
                testY = rect.bottomY;
                retval = Ball.collideSides.BOTTOM;
            } else {
                // The y component of distance is 0
            }

            var distX = this.x - testX;
            var distY = this.y - testY;
            var squareDist = distX * distX + distY * distY;

            if (squareDist < this.radius * this.radius) {
                return retval;
            }

            return Ball.collideSides.NONE;
        },

        draw: function () {
            var rad = Math.PI / 180;

            // Ganked this heart from https://www.html5canvastutorials.com/advanced/html5-canvas-floating-hearts/
            var x1 = this.x + this.radius * Math.cos(this.angle * rad);
            var y1 = this.y + this.radius * Math.sin(this.angle * rad);
            var cx1 = this.x + this.radius * Math.cos((this.angle + 22.5) * rad);
            var cy1 = this.y + this.radius * Math.sin((this.angle + 22.5) * rad);
            var cx2 = this.x + this.radius * Math.cos((this.angle - 22.5) * rad);
            var cy2 = this.y + this.radius * Math.sin((this.angle - 22.5) * rad);
            var chord = 2 * this.radius * Math.sin(22.5 * rad / 2);

            this.canvasCtx.save();
            this.canvasCtx.globalAlpha = this.opacity;
            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(x1, y1);
            this.canvasCtx.arc(cx1, cy1, chord, (270 + this.angle) * rad, (270 + this.angle+ 225) * rad);
            this.canvasCtx.lineTo(this.x, this.y);
            this.canvasCtx.moveTo(x1, y1);
            this.canvasCtx.arc(cx2, cy2, chord, (90 + this.angle) * rad, (90 + this.angle + 135) * rad, true);
            this.canvasCtx.lineTo(this.x, this.y);
            this.canvasCtx.fillStyle = this.color;
            this.canvasCtx.fill();
            this.canvasCtx.lineWidth = 2;
            this.canvasCtx.stroke();
            this.canvasCtx.restore();
        },

        update: function (runningTime) {
            this.x += this.vx;
            this.y += this.vy;

            runningTime = runningTime || 0;

            // We'll do a rotation every two seconds
            this.angle = (runningTime % 2000) / 2000 * 360 - 90;

            // We'll rotate through the hues every 6 seconds
            this.color = hslToRgb(360 * (runningTime % 6000) / 6000, 1, 0.5);

            this.draw();
        },
    }

    /**
     * A rectangular object
     *
     * @param {HTMLCanvasElement} canvas The canvas to draw on
     * @param {number} leftX The top left x coordinate
     * @param {number} topY The top left y coordinate
     * @param {number} rightX The bottom right x coordinate
     * @param {number} bottomY The bottom right y coordinate
     * @param {number} opt_hue An optional hue. If null, will be transparent
     * @param {number} opt_lineWidth An optional linewidth. Default is 1
     * @constructor
     */
    function Rectangle (canvas, leftX, topY, rightX, bottomY, startVx, startVy, opt_hue, opt_lineWidth) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');

        this.leftX = leftX;
        this.topY = topY;
        this.rightX = rightX;
        this.bottomY = bottomY;

        this.vx = startVx || 0;
        this.vy = startVy || 0;

        this.hue = opt_hue;
        this.lineWidth = opt_lineWidth !== undefined ? opt_lineWidth : 1;

        this.opacity = 1;

        this.isActive = true;

        this.init();
    }

    Rectangle.prototype = {

        init: function () {
            this.color = this.hue !== undefined ? hslToRgb(this.hue, 0.5, 0.75) : null;
        },

        draw: function () {
            this.canvasCtx.save();

            this.canvasCtx.globalAlpha = this.opacity;
            this.canvasCtx.beginPath();
            this.canvasCtx.rect(this.leftX, this.topY, this.rightX - this.leftX, this.bottomY - this.topY);
            if (this.lineWidth) {
                this.canvasCtx.strokeStyle = "black";
                this.canvasCtx.lineWidth = this.lineWidth;
                this.canvasCtx.stroke();
            }
            if (this.color !== null) {
                this.canvasCtx.fillStyle = this.color;
                this.canvasCtx.fill();
            }

            this.canvasCtx.restore();
        },

        update: function () {
            this.leftX += this.vx;
            this.rightX += this.vx;
            this.topY += this.vy;
            this.bottomY += this.vy;

            if (this.isActive) {
                this.draw();
            }
        }
    }

    /**
     * Draw centered text at an opacity determined by the progress through the game
     *
     * @param {HTMLCanvasElement} cavnas The canvas element to draw on
     * @param {string} text The text to draw
     * @param {number} xPos The center x position
     * @param {number} yPos The top y position
     * @param {number} height How many pixels high the text should be
     * @param {number} opt_start_opacity Optionally, the starting opacity of the text
     * @param {number} opt_angle Optionally, the starting angle of the text
     * @param {boolean} opt_isActive Optionally, whether the text starts active
     * @param {boolean} opt_isFlippedX Optionally, whether to draw the text flipped about its center
     */
    function Text (canvas, text, xPos, yPos, height, opt_start_opacity, opt_start_angle, opt_isActive, opt_isFlippedX) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');

        this.opacity = opt_start_opacity || 0;
        this.angle = opt_start_angle || 0;
        this.text = text;
        this.xPos = xPos;
        this.yPos = yPos;
        this.height = height;
        this.isActive = opt_isActive === undefined ? true : opt_isActive;
        this.isFlippedX = opt_isFlippedX || false;
    }

    Text.prototype = {
        init: function () {

        },

        draw: function () {
            if (this.isActive) {
                this.canvasCtx.save();

                this.canvasCtx.globalAlpha = this.opacity;
                this.canvasCtx.font = this.height.toString() + 'px serif';
                this.canvasCtx.textAlign = 'center';
                this.canvasCtx.textBaseline = 'bottom';
                this.canvasCtx.translate(this.xPos, this.yPos + this.height / 2);
                this.canvasCtx.rotate(this.angle * Math.PI / 180);
                this.canvasCtx.translate(-this.xPos, -(this.yPos + this.height / 2));
                if (this.isFlippedX) {
                    this.canvasCtx.translate(this.xPos, 0);
                    this.canvasCtx.scale(-1, 1);
                }
                this.canvasCtx.fillText(
                    this.text,
                    (this.isFlippedX ? 0 : 1) * this.xPos,
                    this.yPos + this.height
                );

                this.canvasCtx.restore();
            }
        },

        /**
         *
         * @param {number} activeSquares The number of active squares
         * @param {number} numSquares The number of squares total
         * @param {number} opt_angle Degrees to rotate on draw
         */
        update: function (activeSquares, numSquares, opt_angle, opt_isActive) {
            this.opacity = Math.pow((numSquares - activeSquares) / numSquares, 2);
            this.angle = opt_angle === undefined ? this.angle : opt_angle;
            this.isActive = opt_isActive === undefined ? this.isActive : opt_isActive;
            this.draw();
        }
    }

    /**
     * Create canvas element.
     *
     * @param {HTMLElement} container Element to append canvas to.
     * @param {number} width
     * @param {number} height
     * @param {string} opt_classname
     * @return {HTMLCanvasElement}
     */
    function createCanvas(container, width, height, opt_classname) {
        var canvas = document.createElement('canvas');
        canvas.className = opt_classname ?
            Runner.classes.CANVAS + ' ' + opt_classname :
            Runner.classes.CANVAS;
        canvas.width = width;
        canvas.height = height;
        container.appendChild(canvas);

        return canvas;
    }

    /**
     * Return the current timestampe
     *
     * @returns {number}
     */
    function getTimeStamp() {
        return new Date().getTime();
    }

    /**
     * Convert an HSL triple to RGB.
     *
     * @param {number} h The hue (between 0 and 360 degrees)
     * @param {number} s The saturation (between 0 and 1)
     * @param {number} l The luminosity (between 0 and 1)
     * @returns {string}
     */
    function hslToRgb(h, s, l) {
        var c = (1 - Math.abs(2 * l - 1)) * s;
        var x = c * (1 - Math.abs((h / 60) % 2 - 1));
        var m = l - c / 2;

        var r = 0, g = 0, b = 0;
        if (h < 60) {
            r = c;
            g = x;
        } else if (h < 120) {
            r = x;
            g = c;
        } else if (h < 180) {
            g = c;
            b = x;
        } else if (h < 240) {
            g = x;
            b = c;
        } else if (h < 300) {
            r = x;
            b = c;
        } else {
            r = c;
            b = x;
        }

        r = parseInt((r + m) * 255);
        g = parseInt((g + m) * 255);
        b = parseInt((b + m) * 255);

        return (
            '#' +
            r.toString(16).padStart(2, '0') +
            g.toString(16).padStart(2, '0') +
            b.toString(16).padStart(2, '0')
        );
    }

    /**
     * Return a quadratic easing of x, which is between 0 and 1.
     *
     * @param {number} x between 0 and 1
     * @returns {number} between 0 and 1
     */
    function quadEase(x) {
        var linear = Math.min(1, Math.max(3, 3 - 2 * x));
        return Math.min(1, Math.max(0, x * x * linear));
    }

    /**
     *
     * @param {number} delayTime
     * @param {number} baseTime
     * @param {number} interval
     * @param {number} angle
     * @returns {number}
     */
    function quadEaseAngle(delayTime, interval, angleStart, angleLeft) {
        if (delayTime < 0) {
            return angleStart;
        }

        if (delayTime < interval / 4) {
            return quadEase(delayTime / interval * 4) * angleLeft + angleStart;
        }

        delayTime -= (interval / 4);
        delayTime %= interval;

        if (delayTime < interval / 2) {
            return -2 * quadEase(delayTime / interval * 2) * angleLeft + angleLeft + angleStart;
        }

        delayTime -= interval / 2;
        return 2 * quadEase(delayTime / interval * 2) * angleLeft + - angleLeft + angleStart;
    }

})();

function onDocumentLoad() {
    window['hello'] = new Runner('.interstitial-wrapper');
}

document.addEventListener('DOMContentLoaded', onDocumentLoad);
Crafty.c("Isometric", {
    _d: 0,
    _isoDisplay: null,

    init: function() {
        // define public property 'd'
        Crafty.defineField(this, "d", function() { return this._d; }, function(newValue) {
            var oldValue = this._d;
            if (newValue !== oldValue) {
                this._d = newValue;
                this.trigger("ResizeDepth", oldValue);
            }
        });
        // hide private property '_d'
        Object.defineProperty(this, "_d", {
            value : 0,
            writable : true,
            enumerable : false,
            configurable : false
        });

        
        this._isoDisplay = Crafty.e("2D").attr({ _isoController: this });
        this.bind("Move", this._updateIso);
        this.bind("reorder", this._updateIso);
        this.bind("ResizeDepth", this._updateIso);
        var resizeIso = function(evt) {
            var otherAxis = evt.axis === 'w' ? 'h' : 'w';
            this[otherAxis] = this[evt.axis];
            this._updateIso();
        };
        this.bind("Resize", resizeIso);
        var rotateIso = function(e) {
            if (e.deg % 90 !== 0)
                Crafty.error("Only rotations that are multiples of 90 degrees are supported in Isometric component!");
            this._updateIso();
        };
        this.bind("Rotate", rotateIso);
        this._updateIso();
    },

    remove: function() {
        this._isoDisplay.destroy();
    },

    _updateIso: function() {
        var iso = this._isoDisplay;
        var mbr = this._mbr || this;
        iso.x = mbr._x - mbr._y - mbr._w;
        iso.y = (mbr._x + mbr._y) / 2 - (this._z + this._d);
        iso.z = mbr._x + mbr._y + mbr._w + this._z * 1e6 + (this._d ? 1e5 : 0);
        iso.w = mbr._w + mbr._h;
        iso.h = mbr._h + this._d;
    },

    isometric: function(components, callback) {
        var iso = this._isoDisplay;
        if (components) iso.requires(components);
        if (callback) callback.call(iso, this);

        return this;
    }
});

Crafty.c("Collision3D", {
    init: function() {
        this.requires("Collision");
    },
    hit3D: function(component) {
        var collisionDatas = this.hit(component);

        var i = collisionDatas.length;
        while (--i >= 0) {
            var collider = collisionDatas[i].obj;
            if (!(this._z < collider._z + collider._d && this._z + this._d > collider._z))
                collisionDatas.splice(i, 1);
        }

        return (collisionDatas.length ? collisionDatas : false);
    }
});

Crafty.c("IsometricDraggable", {
    init: function() {
        this.requires("Draggable");
        this.bind("StopDrag", this._isometricStopDrag);
    },
    remove: function() {
        this.unbind("StopDrag", this._isometricStopDrag);
    },
    enableDrag: function () {
        this.uniqueBind("Dragging", this._drag);
        this.uniqueBind("StopDrag", this._isometricStopDrag);
        return this;
    },
    disableDrag: function () {
        this.unbind("Dragging", this._drag);
        this.unbind("StopDrag", this._isometricStopDrag);
        return this;
    },
    _isometricStopDrag: function(e) {
        var diffX = this._x - this._oldX,
            diffY = this._y - this._oldY;
        this._isoController.x += diffX / 2 + diffY;
        this._isoController.y += diffY - diffX / 2;
    }
});

Crafty.extend({
    isometric: {
        isometricToTopdown: function(inPoint, outPoint) {
            var outPoint = outPoint || {};
            outPoint.x = inPoint.x / 2 + inPoint.y;
            outPoint.y = inPoint.y - inPoint.x / 2;
            return outPoint;
        },
        topdownToIsometric: function(inPoint, outPoint) {
            var outPoint = outPoint || {};
            outPoint.x = inPoint.x - inPoint.y;
            outPoint.y = (inPoint.x + inPoint.y) / 2;
            return outPoint;
        },
        _annotateTile: function(x, y, z, w, h, d, tile) {
            tile.addComponent("TILE");

            for (var i = x; i < x + w; i++) {
                tile.addComponent("TILE_X[" + i + "]");
                for (var j = y; j < y + h; j++) {
                    tile.addComponent("TILE_Y[" + j + "]");
                    tile.addComponent("TILE_XY[" + i + "][" + j + "]");
                    for (var k = z; k < z + 1; k++) {
                        tile.addComponent("TILE_Z[" + k + "]");
                        tile.addComponent("TILE_XZ[" + i + "][" + k + "]");
                        tile.addComponent("TILE_YZ[" + j + "][" + k + "]");
                        tile.addComponent("TILE_XYZ[" + i + "][" + j + "][" + k + "]");
                    }
                }
            }

            return tile;
        },
        placeTile: function(tileSize, tile) {
            var x = (typeof tile.x !== "undefined") ? tile.x : 0,
                y = (typeof tile.y !== "undefined") ? tile.y : 0,
                z = (typeof tile.z !== "undefined") ? tile.z : 0,
                w = (typeof tile.w !== "undefined") ? tile.w : 1,
                h = (typeof tile.h !== "undefined") ? tile.h : 1,
                d = (typeof tile.d !== "undefined") ? tile.d : 1,
                c = (typeof tile.c === "string") ? "2D, Isometric, " + tile.c : "2D, Isometric",
                i = (typeof tile.i === "string") ? "IsometricTile, " + tile.i : "IsometricTile";

            return this._annotateTile(x, y, z, w, h, d, Crafty.e(c)
                        .attr({ x: x * tileSize, y: y * tileSize, z: z * tileSize,
                                w: w * tileSize, h: h * tileSize, d: d * tileSize })
                        .isometric(i, function() {
                            this.isometricTile(tileSize);
                        }));
        },
        placeTileMap: function(tileSize, map) {
            var mapEntity = Crafty.e("2D").attr({ x: 0, y: 0, z: 0});
            mapEntity.addComponent("TILEMAP");

            var isoMap = [];
            for (var i = 0; i < map.length; i++) {
                isoMap[i] = [];
                for (var j = 0; j < map[i].length; j++) {
                    isoMap[i][j] = [];

                    var tile = map[i][j];
                    if (tile && tile.constructor === Array) {

                        for (var k = 0; k < tile.length; k++) {
                            var subTile = tile[k];
                            if (subTile) {
                                subTile = Object.create(subTile);
                                subTile.x = i;
                                subTile.y = j;
                                subTile.z = (typeof subTile.z !== "undefined") ? subTile.z : k;
                                subTile.d = (typeof subTile.d !== "undefined") ? subTile.d : 1;

                                var tileEntity = this.placeTile(tileSize, subTile);
                                isoMap[i][j][k] = tileEntity;
                                tileEntity._isoMapController = mapEntity;
                                mapEntity.attach(tileEntity);
                            }
                        }

                    } else if (tile) {
                        tile = Object.create(tile);
                        tile.x = i;
                        tile.y = j;

                        var tileEntity = this.placeTile(tileSize, tile);
                        isoMap[i][j][0] = tileEntity;
                        tileEntity._isoMapController = mapEntity;
                        mapEntity.attach(tileEntity);
                    }
                }
            }

            mapEntity._isoControllerMap = isoMap;
            return mapEntity;
        }
    }
});


Crafty.c("IsometricTile", {
    _tileSize: 0,
    isometricTile: function(tileSize) {
        this._tileSize = tileSize;
        this.trigger("TileSizeChanged", tileSize);
        return this;
    }
});
Crafty.c("IsometricTileDraggable", {
    _diffZ: 0,
    init: function() {
        this.requires("IsometricDraggable")
            .bind("StartDrag", function() {
                this._diffZ = 0;

                Crafty.trigger("EntityStartDrag");
            })
            .bind("KeyDown", function(e) {
                if (e.key === Crafty.keys.SPACE)
                    this._diffZ += this._tileSize;
                else if (e.key === Crafty.keys.CTRL)
                    this._diffZ -= this._tileSize;
            })
            .bind("Dragging", function() {
                this.y -= this._diffZ;

                Crafty.trigger("EntityDragging");
            })
            .bind("StopDrag", function() {
                var isoController = this._isoController;
                var size = this._tileSize;

                isoController.x = Math.round(isoController.x / size) * size;
                isoController.y = Math.round(isoController.y / size) * size;
                isoController.z += this._diffZ;

                Crafty.trigger("EntityStopDrag");
            });
    }
});
Crafty.c("IsometricTileAreaMap", {
    init: function() {
        this.requires("AreaMap");
        this.bind("TileSizeChanged", this._tileAreaMap);
    },
    _tileAreaMap: function(tileSize) {
        if (!tileSize) return;

        if (this._isoController._d) {
            this.areaMap(size,0, size*2,size/2, size*2,size+size/2, size,size*2, 0,size+size/2, 0,size/2);
        } else {
            this.areaMap(size,0, size*2,size/2, size,size, 0,size/2);
        }
    }
});
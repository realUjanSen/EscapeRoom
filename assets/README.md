# Game Assets

This folder contains game assets including:

- **images/**: Game graphics, sprites, and UI elements
- **sounds/**: Audio files for game effects and background music
- **maps/**: Room layouts and map data
- **data/**: Game configuration files and puzzle data

## Structure

```
assets/
├── images/
│   ├── ui/              # UI elements and icons
│   ├── sprites/         # Character and object sprites
│   ├── backgrounds/     # Room backgrounds and textures
│   └── items/          # Game items and collectibles
├── sounds/
│   ├── effects/        # Sound effects
│   └── music/          # Background music
├── maps/
│   └── rooms/          # Room layout definitions
└── data/
    ├── puzzles/        # Puzzle configurations
    └── items/          # Item definitions
```

## Usage

Assets are loaded dynamically by the game engine based on the current room and game state. The game supports common web formats:

- **Images**: PNG, JPG, SVG
- **Audio**: MP3, WAV, OGG
- **Data**: JSON, XML

## Development

When adding new assets:

1. Place files in the appropriate subdirectory
2. Update the asset manifest if needed
3. Reference assets using relative paths from the assets root

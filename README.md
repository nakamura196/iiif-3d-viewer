# IIIF 3D Viewer

A web application for viewing and annotating 3D models based on IIIF Manifest specifications.

## Features

- **3D Model Visualization**: Display GLB/GLTF 3D models from IIIF Manifests
- **Annotation Support**: Create and manage annotations on 3D models
- **Multi-language Support**: Available in English and Japanese
- **Static Export**: Deployable as a static site to any hosting service
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/3D-annotation-viewer.git

# Navigate to project directory
cd 3D-annotation-viewer

# Install dependencies
npm install
# or
yarn install
```

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Build

Build for production:

```bash
npm run build
# or
yarn build
```

### Static Export

This project is configured for static export. After building, the static files will be in the `out` directory:

```bash
npm run build
# Files will be generated in the 'out' directory
```

## Usage

1. Access the application homepage
2. Enter a IIIF Manifest URL containing 3D model information
3. Click "View 3D Model" to open the viewer
4. Use mouse/touch controls to navigate the 3D model
5. Click on the model to add annotations

## Project Structure

```
src/
├── app/
│   └── [locale]/          # Internationalized pages
│       ├── page.tsx       # Homepage
│       ├── viewer/        # 3D viewer page
│       ├── editor/        # Annotation editor
│       ├── help/          # Help page
│       ├── terms/         # Terms of service
│       └── privacy/       # Privacy policy
├── components/            # React components
├── i18n/                  # Internationalization config
├── messages/              # Translation files
│   ├── en.json           # English translations
│   └── ja.json           # Japanese translations
└── lib/                   # Utility functions
```

## Technologies Used

- **Next.js 15**: React framework with App Router
- **React Three Fiber**: React renderer for Three.js
- **next-intl**: Internationalization
- **Tailwind CSS**: Styling
- **TypeScript**: Type safety

## Deployment

This application can be deployed to any static hosting service:

### GitHub Pages

1. Add `basePath` and `assetPrefix` to `next.config.mjs`
2. Build and export the project
3. Deploy the `out` directory to GitHub Pages

### Netlify/Vercel

1. Connect your repository
2. Set build command: `npm run build`
3. Set publish directory: `out`

## Development Team

Developed by The University of Tokyo

## License

[Add your license information here]

## Contributing

[Add contributing guidelines here]
import { registerRootComponent } from 'expo';

import { installErrorHandlers } from './src/lib/diagnostics/installErrorHandlers';
import App from './src/main/App';

// Install global error capture *before* the React tree mounts so even
// boot-time errors land in the diagnostics panel (after buffer flush).
installErrorHandlers();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
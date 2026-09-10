# Connect App – Full Feature and Functionality Documentation

## 1. Overview

Connect is a React Native mobile application built with Expo and designed as a social networking, messaging, media, productivity, and entertainment platform. The app combines a social feed, friend system, direct messaging, voice/video calling, fitness tracking, notes/tasks, games, media apps, AI assistant features, and notifications into a single interface.

At a high level, the product behaves like a hybrid social app and app launcher:

- Users can sign in/register and manage profile information.
- They can view and create social posts in a feed.
- They can message friends and view unread message counts.
- They can accept/send friend requests and browse friends suggestions.
- They can make audio/video calls.
- They can launch mini-app experiences like YouTube, Maps, Contacts, Media Player, and a browser.
- They can access productivity tools such as tasks, notes, and fitness tracking.
- They can play connected game experiences like Ludo and Chess.
- They can receive notifications and background-aware alerts for calls and messages.

---

## 2. Product Purpose

The app is designed to function as a social-first mobile hub where a user can:

- stay connected with friends,
- share updates and media,
- communicate in real time,
- consume videos and media,
- manage daily life through tasks and notes,
- track health and fitness goals,
- access multiple “inside-app” utility experiences,
- interact with an AI-driven assistant.

The app uses a tab-based navigation system and a modern dashboard-style menu screen to group these features.

---

## 3. Platform and Architecture

### Tech stack

- React Native
- Expo SDK
- TypeScript and JavaScript components
- React Navigation
- Redux Toolkit and Redux state management
- Socket.IO client for real-time communication
- Expo Notifications / Notifee for push and in-app notifications
- Agora integration for voice/video calling
- Expo Camera, Image Picker, Media Library, File System, Video, Speech, and Location APIs
- AsyncStorage for local persistence
- Google Sign-In support

### Core architectural pattern

The app is organized around multiple layers:

1. Navigation layer
   - Tab-based interface for Home, Friends, Videos, Messages, and Menu.
   - Stack navigators for nested screens like SinglePost, SingleWatch, FriendProfile, Fitness onboarding, Settings, and app mini-screens.

2. State management layer
   - Redux slices manage chat, notifications, profile, posts, and presence state.
   - Context providers handle auth, theme, settings, socket, Ludo, Chess, call minimize state, and toast handling.

3. Service layer
   - API client handles backend communication.
   - Socket service handles live connectivity and event-driven updates.
   - Notification and call service logic handles incoming call alerts and permission management.

4. Screen layer
   - Screen components control the UI for user flows, social activity, media, productivity, and utilities.

---

## 4. Main User Flows

### 4.1 Authentication flow

The app supports a login and registration journey:

- Login screen for existing users
- Register screen for new account creation
- Auth context store for user session status
- User logout with confirmation
- Profile persistence and access to protected app views

The app loads the authenticated state and then exposes the main tabs only when the user is signed in.

### 4.2 App entry and home experience

After login, the user enters the main app experience:

- Home feed as the primary social dashboard
- Story/updates area
- Post feed with lazy loading, refresh, and caching
- New-post notifications when fresh items arrive
- Floating or advanced tab navigation

---

## 5. Social Features

### 5.1 News feed / social timeline

The Home screen is the main social feed and contains several major features:

- Fetches posts from a backend feed API
- Caches feed content locally
- Supports pull-to-refresh
- Supports infinite scroll / load more
- Deduplicates posts to avoid duplicates
- Displays a “new posts” notification banner when fresh content appears
- Displays stories and post cards with rich metadata

Key feed-related components:

- Home.tsx
- CreatePost.tsx
- Post.tsx
- StorySlider.tsx
- FeedBoostCards.tsx
- PostSkeleton.tsx

### 5.2 Create and manage posts

The app includes a post creation workflow:

- Create a post with text/caption
- Add or attach media (camera/gallery-based flow)
- Review content before publishing
- Navigate to post detail view or edit screen
- Edit existing post details in a dedicated view
- View single post in a dedicated screen

The app includes navigation routes for:

- SinglePost
- EditPost
- Camera
- Gallery
- GalleryPreview

### 5.3 Post interaction model

The social feed supports a rich post interaction model, including:

- viewing post content and metadata,
- entering single-post detail screens,
- interacting with profiles tied to posts,
- editing or deleting workflow hooks,
- feed refresh and cache invalidation,
- event-driven updates when a post changes.

---

## 6. Friends and Social Graph

### 6.1 Friend request system

The Friends tab includes a friend-management workflow:

- View friend requests
- Send friend requests to suggested users
- Remove or cancel requests
- Accept incoming requests
- Delete friend requests
- Fetch suggestions from backend
- Cache friend request data locally for quick loading

Friend management logic is implemented through friend API calls and cache utilities.

### 6.2 Friend profile screens

The app supports dedicated profile screens for:

- current user profile,
- friend profiles,
- social profile display,
- profile image and verified name rendering.

The profile system includes:

- profile avatar display,
- display name formatting,
- friend presence state,
- profile navigation from posts and chat threads.

---

## 7. Messaging and Chat

### 7.1 Chat list

The Message screen provides a chat dashboard with:

- list of conversations,
- profile images and names,
- last message preview,
- unread message count badges,
- online/offline presence,
- time-ago metadata,
- cached chat history,
- pull-to-refresh,
- skeleton loading state.

### 7.2 Conversation threading

Each conversation supports:

- sending text messages,
- sending image/photo attachments,
- sending voice messages,
- viewing message read/unread state,
- browsing call history messages,
- navigating to user profile from the chat view,
- use of AI voice input support.

### 7.3 Call-related message previews

The app recognizes different message types including:

- text messages,
- photo attachments,
- voice messages,
- audio-call records,
- video-call records,
- missed call entries.

This allows chat list previews to display appropriate icons and labels for different message types.

### 7.4 AI voice input in messaging

The app integrates an AI assistant and voice input support:

- speech-enabled message input,
- language selection for voice input,
- AI assistant modal for interactive support.

This is implemented through voice text input components and speech service support.

---

## 8. Calls and Real-Time Communication

### 8.1 Audio and video calling

The app includes full calling infrastructure based on real-time communication and call UI components:

- AudioCall.tsx
- VideoCall.tsx
- IncomingCall.tsx
- OutgoingCall.tsx
- LiveVoice.tsx
- MinimizedCallBar.tsx
- CallMinimizeContext

Features include:

- incoming call handling,
- outgoing call flow,
- minimized in-app call bar,
- call acceptance/rejection flow,
- ring tones and custom incoming call handling,
- call notification actions,
- background-aware call behavior,
- socket-driven event coordination.

### 8.2 Notification-based call alerts

The app supports background call notifications and system wake flows, including:

- foreground service and background service handling,
- full-screen call alerts,
- accept/reject notification buttons,
- battery optimization handling,
- app state observation for incoming-call logic,
- call notification bridging for integration with external call events.

### 8.3 Real-time socket layer

The app uses a socket context and socket service for:

- message events,
- call events,
- user presence updates,
- notification delivery,
- live app activity updates.

This ties together the social network, messaging, and calling experiences.

---

## 9. Media, Video, and Entertainment Features

### 9.1 Video tab and watch experience

The Videos section contains:

- video feed viewing,
- watch page navigation,
- individual video detail screen,
- video playback support,
- caching/pip-like watch experience,
- watch player helper utilities.

### 9.2 YouTube / web-style video content integration

The app includes a dedicated YouTube screen and a menu launcher for YouTube-style experiences. This suggests app-level integration for video discovery or viewing.

### 9.3 Media player and downloads

The app includes media features such as:

- media player screen,
- downloads screen,
- saved video management,
- media library support,
- file-system-based handling for downloads and saved media.

### 9.4 Camera and gallery

The app supports photography and media capture flows:

- camera screen,
- gallery screen,
- gallery preview,
- image cropping modal,
- profile image handling,
- media upload and attachment flows.

This is used for post creation and user profile media handling.

---

## 10. App Launcher and Utility Apps

The Menu screen acts like a dashboard or app launcher and contains a large set of mini-app experiences. These are not all separate standalone apps, but they are presented as working or mock app entries.

### 10.1 Games

- Ludo
- Chess
- Cricbuzz

These are represented as app tiles in the launcher and can open into dedicated game or sports content screens.

### 10.2 Media and utility apps

- Media Player
- YouTube
- Camera
- Gallery
- Downloads
- Facebook
- Maps
- Contacts
- VPN Browser

### 10.3 Productivity/utility categories

- Settings
- Tasks
- Notes
- Fitness dashboard
- Profile

The app uses a searchable “AppGrid” style interface for these items, with labels, icons, colors, and action handlers.

---

## 11. Productivity Tools

### 11.1 Tasks

The Tasks screen allows users to keep track of personal or work-related actions. It is part of the Menu stack and is designed as a lightweight productivity tool.

### 11.2 Notes

The Notes screen is a capture-and-management area for personal notes, ideas, and reminders.

### 11.3 Profile management

The app includes a dedicated MyProfile screen for:

- viewing user profile,
- managing profile information,
- connected profile image,
- navigation to settings and friends.

---

## 12. Fitness and Health Features

The app includes a structured fitness workflow with separate screens:

- FitnessOnboarding
- FitnessDashboard
- FitnessMeal
- FitnessConfirmation
- FitnessWeight
- FitnessProgress
- FitnessReminders
- FitnessCoach
- FitnessRecommendations

These screens suggest a health-focused journey with features such as:

- onboarding for fitness setup,
- dashboard summarizing progress,
- meal planning,
- target/goals confirmation,
- weight tracking,
- progress monitoring,
- reminders,
- coaching guidance,
- recommendation-based personalization.

This makes the app a broader life-management platform, not just a social feed.

---

## 13. Settings and App Controls

The Settings screen is part of the app’s navigation and handles configuration and account controls. It includes:

- user settings,
- profile-related preferences,
- privacy/account management,
- permission handling,
- notification configuration,
- app update checks,
- theme configuration,
- general app behavior management.

Additional support includes:

- Theme provider with dark mode support
- Status bar configuration
- Remote config hooks
- Update modal and version checks

---

## 14. AI Features

### 14.1 AI agent modal

The app contains an AIAgentModal component, which is surfaced in the Menu screen and other places. This enables:

- AI interaction modal flow,
- speech-driven user input choices,
- language selection and voice handling,
- user support behaviors and agent-driven assistance.

### 14.2 Voice and speech support

The app provides:

- voice text input support,
- text-to-speech playback for messages,
- speech recognition through voice-enabled UI flows,
- multi-language voice options such as English and Bangla.

This makes the app more interactive, accessible, and conversational.

---

## 15. Notifications and Background Processing

The app includes support for system and app-level notification features beyond simple in-app alerts:

- Expo push notifications
- Notifee rich notification handling
- background task management
- battery optimization handling on Android
- incoming call notification experience
- local notification and status tracking
- app updates and event notifications

The project includes guide documents such as:

- BACKGROUND_SETUP_GUIDE.md
- FCM_PRODUCTION_SETUP.md

These show that the app was designed with production-level push and background support in mind.

---

## 16. Security, Permissions, and System Access

The app requests or integrates with system-level features such as:

- location permission
- camera permissions
- media file access
- notifications permission
- background task permissions
- battery optimization exemptions on Android

This is necessary for:

- location-aware features,
- media capture,
- voice and speech features,
- calls and notifications,
- media playback and downloads.

---

## 17. User Experience Features

The app has several UX improvements and polish elements:

- dark/light themed interface
- custom tab bar with badges and icons
- smooth stack transitions between screens
- loading states and skeletons
- responsive app grid and modern menu design
- status bar and progress indicators
- floating/in-app overlays and overlays for call and AI interactions
- pull-to-refresh and infinite scrolling in feeds and lists
- toast notifications and user feedback messages

---

## 18. Functional Screen Map

The app navigation is organized into the following key stacks:

### Main tabs
- Home
- Friends
- Videos
- Message
- Menu

### Home stack
- HomeMain
- SinglePost
- SingleWatch
- EditPost
- FriendProfile
- Camera
- Gallery
- GalleryPreview

### Message stack
- MessageList
- SingleMessage
- FriendProfile
- SinglePost
- EditPost
- SingleWatch

### Friends stack
- FriendsMain
- FriendProfile
- SinglePost
- EditPost
- SingleWatch

### Menu stack
- MenuHome
- MyProfile
- Settings
- Tasks
- Notes
- FitnessOnboarding
- FitnessDashboard
- FitnessMeal
- FitnessConfirmation
- FitnessWeight
- FitnessProgress
- FitnessReminders
- FitnessCoach
- FitnessRecommendations
- MediaPlayer
- Facebook
- YouTube
- VpnBrowser
- Cricbuzz
- GoogleMaps
- GoogleContacts
- VideoLibrary
- Downloads

---

## 19. Notable Implementation Highlights

Some of the most important implementation characteristics are:

- social app + communication app hybrid model
- strong use of Redux for global state
- socket-layer based real-time updates
- tabbed app architecture with nested navigation
- app-grid menu launcher for integrated utility experiences
- educational/placeholder screens for app-like experiences and social media ecosystems
- support for media, notifications, calls, and health tracking inside a single app shell

---

## 20. Summary of Core Features

In summary, Connect includes the following core feature areas:

- Authentication and user management
- Social media feed and post publishing
- Stories and feed refresh behavior
- Friend requests and social networking
- Messaging and chat list management
- Real-time socket-based communication
- Audio/video call support
- Media capture, gallery, and downloads
- Video watching and app-like media experiences
- AI assistant and voice input integration
- Fitness onboarding and health tracking
- Task and note management
- App launcher / utility dashboard
- Notifications and background service support
- Profile management and settings
- Theme support and user experience polish

---

## 21. Practical Conclusion

Connect is best described as a comprehensive social and lifestyle mobile app that blends communication, media consumption, utility apps, entertainment, and personal productivity into one experience. It is clearly designed beyond a simple messaging app, serving as a full “connected lifestyle” platform with social, productivity, fitness, and real-time communication features.

This makes it suitable for use cases such as:

- social networking,
- direct messaging,
- community engagement,
- video/media consumption,
- personal task and note management,
- health tracking,
- entertainment and mini-game experiences,
- communication and call-driven user interaction.

---

## 22. Suggested Documentation Maintenance

This document should be updated whenever new screens or features are introduced. As the project evolves, the most important items to keep in sync are:

- new routed screens,
- new app launcher entries,
- chat and call feature changes,
- AI assistant/new speech features,
- notification and background capability upgrades,
- fitness and productivity module changes.

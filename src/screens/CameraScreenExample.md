# 📸 Camera Screen - Quick Reference

## Navigation Examples

### From Any Component
```typescript
import { useNavigation } from '@react-navigation/native';

function MyComponent() {
  const navigation = useNavigation();
  
  return (
    <TouchableOpacity onPress={() => (navigation as any).navigate('Camera')}>
      <Icon name="camera-alt" size={24} />
      <Text>Open Camera</Text>
    </TouchableOpacity>
  );
}
```

### From Home Screen
Camera button is already integrated in the CreatePost component at the top of the Home screen.

### Passing Callback for Photo
```typescript
// Navigate with params
navigation.navigate('Camera', {
  onPhotoTaken: (photoPath: string) => {
    console.log('Photo taken:', photoPath);
    // Process the photo
  }
});

// In CameraScreen, handle the callback
const route = useRoute();
const onPhotoTaken = route.params?.onPhotoTaken;

// After taking photo:
if (onPhotoTaken) {
  onPhotoTaken(photo.path);
  navigation.goBack();
}
```

## Features Checklist

### Photography
- ✅ Photo capture with flash
- ✅ Video recording with audio
- ✅ Front/back camera switch
- ✅ Pinch to zoom
- ✅ Quick zoom buttons (1x, 2x, 5x)
- ✅ Timer (3s, 10s)
- ✅ HDR mode
- ✅ Live Photo toggle
- ✅ Flash (Off/On/Auto)

### Gestures
- ✅ Pinch to zoom
- ✅ Single tap to focus
- ✅ Double tap to flip camera

### UI/UX
- ✅ iPhone-style interface
- ✅ Mode switcher (Photo/Video/Portrait/Square/Pano)
- ✅ Recording timer display
- ✅ Zoom level indicator
- ✅ Flash animation on capture
- ✅ Permission handling
- ✅ Loading states

## Common Use Cases

### 1. Profile Picture Update
```typescript
// From profile screen
<TouchableOpacity onPress={() => {
  navigation.navigate('Camera', {
    mode: 'photo',
    cameraPosition: 'front',
    onPhotoTaken: async (path: string) => {
      // Upload as profile picture
      await uploadProfilePic(path);
      navigation.goBack();
    }
  });
}}>
  <Text>Take Profile Photo</Text>
</TouchableOpacity>
```

### 2. Post Creation
Already integrated in CreatePost component - users can tap "Camera" button.

### 3. Story/Reel Creation
```typescript
navigation.navigate('Camera', {
  mode: 'video',
  maxDuration: 15, // 15 seconds for stories
  onVideoRecorded: (path: string, duration: number) => {
    // Process video for story
  }
});
```

### 4. QR Code Scanner
```typescript
// Add to CameraScreen.tsx
const codeScanner = useCodeScanner({
  codeTypes: ['qr', 'ean-13'],
  onCodeScanned: (codes) => {
    console.log('Scanned:', codes[0].value);
  }
});

// In camera component:
<Camera
  {...props}
  codeScanner={codeScanner}
/>
```

## Customization Examples

### Custom Zoom Levels
```typescript
// In CameraScreen.tsx, modify:
<View style={styles.zoomControls}>
  <TouchableOpacity onPress={() => zoom.value = withSpring(0.5)}>
    <Text>0.5x</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => zoom.value = withSpring(1)}>
    <Text>1x</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => zoom.value = withSpring(2)}>
    <Text>2x</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => zoom.value = withSpring(10)}>
    <Text>10x</Text>
  </TouchableOpacity>
</View>
```

### Add Filter/Effect Mode
```typescript
type CameraMode = 'photo' | 'video' | 'portrait' | 'pano' | 'square' | 'night' | 'bokeh';

// Add night mode logic
const takeNightPhoto = async () => {
  // Multiple exposures
  const photos = [];
  for (let i = 0; i < 3; i++) {
    const photo = await camera.current.takePhoto({
      qualityPrioritization: 'quality'
    });
    photos.push(photo);
    await delay(500);
  }
  // Merge photos for better low-light quality
  return mergePhotos(photos);
};
```

### Custom Flash Animation
```typescript
const triggerCustomFlash = () => {
  Animated.sequence([
    Animated.timing(flashOpacity, {
      toValue: 0.8,
      duration: 50,
      useNativeDriver: true,
    }),
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }),
  ]).start();
};
```

### Add Countdown Timer UI
```typescript
const [countdown, setCountdown] = useState<number | null>(null);

// In takePhoto function:
if (timer > 0) {
  for (let i = timer; i > 0; i--) {
    setCountdown(i);
    await delay(1000);
  }
  setCountdown(null);
}

// In render:
{countdown && (
  <View style={styles.countdownOverlay}>
    <Text style={styles.countdownText}>{countdown}</Text>
  </View>
)}

// Styles:
countdownOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0,0,0,0.5)',
},
countdownText: {
  fontSize: 120,
  fontWeight: 'bold',
  color: '#fff',
},
```

## Testing Checklist

### Before Release
- [ ] Test on physical Android device
- [ ] Test on physical iOS device
- [ ] Verify camera permissions work
- [ ] Test photo capture in different lighting
- [ ] Test video recording with audio
- [ ] Test front camera selfie mode
- [ ] Test zoom at various levels
- [ ] Test flash modes
- [ ] Test timer functionality
- [ ] Verify photos save correctly
- [ ] Test on different screen sizes
- [ ] Test rotation handling
- [ ] Check memory usage during recording
- [ ] Verify no crashes on rapid button taps

### Performance
- [ ] Camera loads quickly
- [ ] Zoom is smooth (60fps)
- [ ] No lag when switching cameras
- [ ] Recording starts immediately
- [ ] UI is responsive

## Troubleshooting

### Camera shows black screen
```typescript
// Add debug logging
useEffect(() => {
  console.log('Device:', device);
  console.log('Has permission:', hasPermission);
  console.log('Is focused:', isFocused);
}, [device, hasPermission, isFocused]);
```

### Photos not saving
```bash
# Install camera roll
npm install @react-native-camera-roll/camera-roll

# Update takePhoto
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

const photo = await camera.current.takePhoto({...});
await CameraRoll.save(`file://${photo.path}`, { type: 'photo' });
```

### Permission denied error
```typescript
// Request permissions manually
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const requestCameraPermission = async () => {
  const result = await request(
    Platform.OS === 'ios' 
      ? PERMISSIONS.IOS.CAMERA 
      : PERMISSIONS.ANDROID.CAMERA
  );
  
  if (result === RESULTS.GRANTED) {
    console.log('Camera permission granted');
  } else {
    Alert.alert('Permission Required', 'Camera access is required');
  }
};
```

## Pro Tips

1. **Always test on real devices** - Camera doesn't work on emulators
2. **Handle low storage** - Check before recording videos
3. **Battery optimization** - Camera is battery-intensive
4. **Use quality settings** - Balance quality vs file size
5. **Implement preview** - Let users review before saving
6. **Add haptic feedback** - Improve UX with vibrations
7. **Show storage info** - Display available space
8. **Auto-save to cloud** - Backup important photos
9. **Add EXIF data** - Include location, date, etc.
10. **Optimize for tablets** - Adjust UI for larger screens


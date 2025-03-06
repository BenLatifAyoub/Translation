import React, { useState } from 'react';
import { Audio } from 'expo-av';
import Feather from '@expo/vector-icons/Feather';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { StyleSheet, View, Text, TouchableOpacity, Image, ActivityIndicator, ImageBackground } from 'react-native';
import * as Font from 'expo-font';

export default function HomeScreen() {
  const [englishText, setEnglishText] = useState('');
  const [tunisianText, setTunisianText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecordingEnglish, setIsRecordingEnglish] = useState(false);
  const [isLoadingEnglish, setIsLoadingEnglish] = useState(false); // New loading state for English
  const [isLoadingTunisian, setIsLoadingTunisian] = useState(false); // New loading state for Tunisian

  const startRecording = async (isEnglish: any) => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone access is required!');
        return;
      }
      // Set loading state instead of text
      setIsLoadingEnglish(isEnglish);
      setIsLoadingTunisian(!isEnglish);
      setEnglishText(isEnglish ? "Listening..." : englishText);
      setTunisianText(!isEnglish ? "Listening..." : tunisianText);

      console.log('Starting recording...', isEnglish ? 'English' : 'Tunisian');

      const recordingObject = new Audio.Recording();
      await recordingObject.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recordingObject.startAsync();
      setRecording(recordingObject);
      setIsRecordingEnglish(isEnglish);
      console.log('Recording started');
    } catch (error) {
      console.error("Error starting recording:", error);
      setEnglishText(isEnglish ? "Error starting recording." : englishText);
      setTunisianText(!isEnglish ? "Error starting recording." : tunisianText);
      setIsLoadingEnglish(false);
      setIsLoadingTunisian(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (recording) {
        console.log('Stopping recording...');
        await recording.stopAndUnloadAsync();
        const tempUri = recording.getURI();
        setRecording(null);
        console.log('Temp URI:', tempUri);

        if (tempUri) {
          const fileName = `myRecording-${Date.now()}.m4a`;
          const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.moveAsync({ from: tempUri, to: permanentUri });
          console.log('Permanent URI:', permanentUri);

          const fileInfo = await FileSystem.getInfoAsync(permanentUri);
          console.log('File info:', fileInfo);
          if (!fileInfo.exists) {
            setEnglishText(isRecordingEnglish ? "File does not exist." : englishText);
            setTunisianText(!isRecordingEnglish ? "File does not exist." : tunisianText);
            setIsLoadingEnglish(false);
            setIsLoadingTunisian(false);
            return;
          }

          setEnglishText(isRecordingEnglish ? "Uploading and processing..." : englishText);
          setTunisianText(!isRecordingEnglish ? "Uploading and processing..." : tunisianText);

          console.log('Sending request to server...');
          const endpoint = isRecordingEnglish ? 'english' : 'tunisian';
          const uploadResponse = await FileSystem.uploadAsync(`http://10.72.0.124:8000/upload/${endpoint}`, permanentUri, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'file',
            parameters: {
              name: fileName,
              type: 'audio/m4a',
            },
          });
          console.log('Upload response status:', uploadResponse.status);

          const uploadData = JSON.parse(uploadResponse.body);
          console.log('Upload response data:', uploadData);

          if (uploadResponse.status === 200 && uploadData.transcription && uploadData.translation) {
            if (isRecordingEnglish) {
              setEnglishText(uploadData.transcription);
              setTunisianText(uploadData.translation);
            } else {
              setTunisianText(uploadData.transcription);
              setEnglishText(uploadData.translation);
            }
          } else {
            const errorMsg = uploadData.error || "Unknown error";
            setEnglishText(isRecordingEnglish ? `Transcription failed: ${errorMsg}` : englishText);
            setTunisianText(!isRecordingEnglish ? `Transcription failed: ${errorMsg}` : tunisianText);
          }
        } else {
          setEnglishText(isRecordingEnglish ? "No file saved." : englishText);
          setTunisianText(!isRecordingEnglish ? "No file saved." : tunisianText);
        }
      }
      Speech.stop();
      setIsLoadingEnglish(false); // Reset loading states
      setIsLoadingTunisian(false);
    } catch (error) {
      console.error("Error stopping recording:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setEnglishText(isRecordingEnglish ? `Error: ${errorMsg}` : englishText);
      setTunisianText(!isRecordingEnglish ? `Error: ${errorMsg}` : tunisianText);
      setIsLoadingEnglish(false);
      setIsLoadingTunisian(false);
    }
  };

  const speak = (text: any, language: any) => {
    Speech.stop();
    Speech.speak(text, { language });
  };

  return (
    //   <ImageBackground
    //   source={require('../../assets/images/background.png')}
    //   style={{flex:1}}
    //   resizeMode="repeat" 
    //   imageStyle={{width:"100%",height:"15%",opacity:0.5}} // Works only on iOS
    // >
    <View style={styles.container}>
      <View style={styles.topSection}>
      <Image style={styles.image3} source={require('../../assets/images/logos.png')} />
      </View>

      <ImageBackground
        source={require('../../assets/images/background.png')}
        style={styles.background}
        resizeMode="repeat"
        imageStyle={{ borderTopLeftRadius: 30, borderTopRightRadius: 30 }} // Works only on iOS
      >
        <View style={styles.bottomSection}>
          <View style={styles.textInput}>
            <Image style={styles.image1} source={require('../../assets/images/burger.png')} />
            {isLoadingEnglish ? (
              <ActivityIndicator size="large" color="#00C6FF" style={styles.loader} />
            ) : (
              <Text style={[styles.text, { fontFamily: 'Arial' }]}>{englishText || "Press to Speak"}</Text>
            )}
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={() => speak(englishText, 'en')} style={styles.speakerButton}>
                <Feather name="volume-2" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={recording ? stopRecording : () => startRecording(true)}
                style={styles.micButton}>
                <Feather name={recording && isRecordingEnglish ? "square" : "mic"} size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.textInput}>
            <Image style={styles.image} source={require('../../assets/images/chili.png')} />
            {isLoadingTunisian ? (
              <ActivityIndicator size="large" color="#00C6FF" />
            ) : (
              <Text style={[styles.text, { fontFamily: 'Arial' }]}>{tunisianText || "انزل باش تحكي"}</Text>
            )}
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={() => speak(tunisianText, 'ar')} style={styles.speakerButton}>
                <Feather name="volume-2" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={recording ? stopRecording : () => startRecording(false)}
                style={styles.micButton}>
                <Feather name={recording && !isRecordingEnglish ? "square" : "mic"} size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
    // </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundTop: {
    opacity: 0.6,
  },
  background: {
    flex: 1,
    borderRadius: 30,
  },
  container: {
    backgroundColor: "transparent",
    flex: 1,
  },
  statusBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Constants.statusBarHeight,
    zIndex: 10, // Ensures it sits above other elements
  },
  topSection: {
    height: "10%",
    zIndex: 10,
    alignItems: 'center',
    opacity: 0.9,
    elevation: 100,
    backgroundColor: 'transparent',
    alignContent: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginBottom: 20, // Match the text margin for alignment
  },
  bottomSection: {
    height: "100%",
    backgroundColor: "transparent",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden", // ensures children are clipped to the rounded corners
    alignItems: "center",
  },
  image: {
    zIndex: 1,
    height: 40,
    width: 40,
    position: 'absolute',
    top: 10,
    left: 10,
  },
  image1: {
    zIndex: 1,
    height: 40,
    width: 40,
    position: 'absolute',
    top: 10,
    left: 10,
  },
  image3: {
    zIndex: 1,
    height: "100%",
    width: "100%",

  },
  textInput: {
    height: "37%",
    width: "90%",
    elevation: 10,
    backgroundColor: 'white',
    opacity: 0.9,
    borderRadius: 30,
    marginTop: 20,
    padding: 20,
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Arial', // Applied globally for this text style
  },
  buttonRow: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakerButton: {
    backgroundColor: '#2596be',
    padding: 10,
    borderRadius: 30,
    position: 'absolute',
    top: 40,
    left: 80,
  },
  micButton: {
    backgroundColor: '#2596be',
    padding: 10,
    borderRadius: 30,
    position: 'absolute',
    top: 40,
    right: 80,
  },
});

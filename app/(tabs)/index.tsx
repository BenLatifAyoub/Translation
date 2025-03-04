import React, { useState } from 'react';
import { Audio } from 'expo-av';
import Feather from '@expo/vector-icons/Feather';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';

export default function HomeScreen() {
  const [englishText, setEnglishText] = useState('');
  const [tunisianText, setTunisianText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecordingEnglish, setIsRecordingEnglish] = useState(false);

  const startRecording = async (isEnglish: boolean) => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone access is required!');
        return;
      }

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
            return;
          }

          setEnglishText(isRecordingEnglish ? "Uploading and processing..." : englishText);
          setTunisianText(!isRecordingEnglish ? "Uploading and processing..." : tunisianText);

          const formData = new FormData();
          formData.append('file', {
            uri: permanentUri,
            name: fileName,
            type: 'audio/m4a',
          } as any);

          console.log('Sending request to server...');
          const endpoint = isRecordingEnglish ? 'english' : 'tunisian';
          const uploadResponse = await fetch(`http://10.72.0.124:8000/upload/${endpoint}`, {
            method: 'POST',
            body: formData,
          });
          console.log('Upload response status:', uploadResponse.status);

          const uploadData = await uploadResponse.json();
          console.log('Upload response data:', uploadData);

          if (uploadResponse.ok && uploadData.transcription && uploadData.translation) {
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
    } catch (error) {
      console.error("Error stopping recording:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setEnglishText(isRecordingEnglish ? `Error: ${errorMsg}` : englishText);
      setTunisianText(!isRecordingEnglish ? `Error: ${errorMsg}` : tunisianText);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection} />
      <View style={styles.bottomSection}>
        <Image style={styles.image1} source={require('../../assets/images/britsh.png')} />
        <View style={styles.textInput}>
          <Text>{englishText || "Press to Speak"}</Text>
          <TouchableOpacity
            onPress={recording ? stopRecording : () => startRecording(true)}
            style={styles.micButton}>
            <Feather name={recording && isRecordingEnglish ? "square" : "mic"} size={24} color="white" />
          </TouchableOpacity>
        </View>

        <Image style={styles.image} source={require('../../assets/images/tunisia.png')} />
        <View style={styles.textInput}>
          <Text>{tunisianText || "Inzel bach ta7ki"}</Text>
          <TouchableOpacity
            onPress={recording ? stopRecording : () => startRecording(false)}
            style={styles.micButton}>
            <Feather name={recording && !isRecordingEnglish ? "square" : "mic"} size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    flex: 1,
  },
  topSection: {
    height: "20%",
    backgroundColor: "#44a2f7",
    borderBottomRightRadius: 30,
  },
  bottomSection: {
    height: "80%",
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    alignItems: "center",
  },
  image: {
    zIndex: 1,
    height: 40,
    width: 40,
    borderRadius: 30,
    position: 'absolute',
    bottom: 300,
    left: 30,
  },
  image1: {
    zIndex: 1,
    height: 40,
    width: 40,
    borderRadius: 30,
    position: 'absolute',
    top: 20,
    left: 30,
  },
  textInput: {
    height: "40%",
    width: "90%",
    elevation: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    marginTop: 10,
  },
  micButton: {
    backgroundColor: '#44a2f7',
    padding: 10,
    borderRadius: 30,
    position: 'absolute',
    bottom: 20,
  },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { trpc } from '@/lib/trpc'; // Assuming @ refers to root
import Button from '@/components/Button'; // Assuming @ refers to root
import PlayerAvatar from '@/components/PlayerAvatar'; // Assuming @ refers to root
import { Player } from '@/types'; // Assuming @ refers to root

export default function EditProfileScreen() {
  const { data: profile, isLoading: isLoadingProfile, error: profileError, refetch } = trpc.player.getProfile.useQuery();
  const { mutate: updateProfile, isLoading: isUpdatingProfile, error: updateError } = trpc.player.updateProfile.useMutation();

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setNickname(profile.nickname || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  const handleUpdateProfile = () => {
    setSuccessMessage(null); // Clear previous success message
    
    const input: { name?: string; nickname?: string | null; avatar_url?: string | null } = {};
    if (name !== profile?.name) {
        input.name = name;
    }
    // Send nickname if it changed or if it was initially null and now has a value
    if (nickname !== (profile?.nickname || '') ) {
        input.nickname = nickname === '' ? null : nickname;
    }
    // Send avatarUrl if it changed or if it was initially null and now has a value
    if (avatarUrl !== (profile?.avatar_url || '')) {
        input.avatar_url = avatarUrl === '' ? null : avatarUrl;
    }

    // Only call mutation if there's something to update
    if (Object.keys(input).length === 0) {
        setSuccessMessage("No changes to save.");
        return;
    }
    
    // Validate name: ensure it's not empty if provided
    if (input.name !== undefined && input.name.trim() === '') {
        Alert.alert("Validation Error", "Name cannot be empty.");
        return;
    }

    // Validate avatar_url: basic URL check if provided and not null
    if (input.avatar_url !== undefined && input.avatar_url !== null && input.avatar_url.trim() !== '') {
        try {
            new URL(input.avatar_url);
        } catch (_) {
            Alert.alert("Validation Error", "Avatar URL is not valid. Please leave empty or provide a valid URL.");
            return;
        }
    }


    updateProfile(input, {
      onSuccess: (updatedData) => {
        setSuccessMessage('Profile updated successfully!');
        refetch(); // Refetch the profile data to show updated values
        // Potentially update local form state if backend returns the updated object
        if (updatedData) {
            setName(updatedData.name || '');
            setNickname(updatedData.nickname || '');
            setAvatarUrl(updatedData.avatar_url || '');
        }
        setTimeout(() => setSuccessMessage(null), 3000); // Clear message after 3s
      },
      onError: (error) => {
        // Error is already captured by `updateError` state, but specific actions can be taken here
        console.error("Update profile error:", error);
        Alert.alert("Update Failed", error.message || "Could not update profile.");
      }
    });
  };

  if (isLoadingProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading profile...</Text>
      </View>
    );
  }

  if (profileError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error loading profile: {profileError.message}</Text>
        <Button title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text>No profile data found.</Text>
         <Button title="Retry" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Your Profile</Text>

      <View style={styles.avatarContainer}>
        <PlayerAvatar  
            player={{ name: name || 'Player', avatarUrl: avatarUrl || undefined } as Player} 
            size={100} 
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nickname</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="Your nickname (optional)"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Avatar URL</Text>
        <TextInput
          style={styles.input}
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          placeholder="URL to your avatar image (optional)"
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>

      {isUpdatingProfile && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Saving...</Text>
        </View>
      )}
      
      {updateError && (
        <Text style={[styles.errorText, styles.messageText]}>Update Error: {updateError.message}</Text>
      )}
      {successMessage && (
        <Text style={[styles.successText, styles.messageText]}>{successMessage}</Text>
      )}

      <Button
        title="Save Changes"
        onPress={handleUpdateProfile}
        disabled={isUpdatingProfile || isLoadingProfile}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  container: {
    padding: 20,
    alignItems: 'stretch', // Default, good for forms
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  successText: {
    color: 'green',
    marginBottom: 10,
    textAlign: 'center',
  },
  messageText: {
    marginTop: 10,
    fontSize: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#555',
  }
});

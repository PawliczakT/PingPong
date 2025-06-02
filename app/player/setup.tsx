import React, {useEffect, useState} from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuthStore} from '@/store/authStore';
import {usePlayerStore} from '@/store/playerStore';
import {supabase} from '@/lib/supabase';
import Button from '@/components/Button';
import {colors} from '@/constants/colors';
import {Camera, Image as ImageIcon} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';

const SetupProfileScreen = () => {
    const router = useRouter();
    const {isNewUser} = useLocalSearchParams<{ isNewUser?: string }>();
    const {user} = useAuthStore();
    const {addPlayer} = usePlayerStore();

    const [name, setName] = useState('');
    const [nickname, setNickname] = useState('');
    const [image, setImage] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user?.email && !name) {
            const emailName = user.email.split('@')[0];
            const formattedName = emailName
                .split('.')
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
            setName(formattedName);
        }
    }, [user]);

    // Handle back button if this is a new user (don't let them go back to login)
    useEffect(() => {
        if (isNewUser === 'true') {
            const backHandler = () => true; // Prevent going back
            BackHandler.addEventListener('hardwareBackPress', backHandler);
            return () => BackHandler.removeEventListener('hardwareBackPress', backHandler);
        }
    }, [isNewUser]);

    const pickImage = async () => {
        try {
            const {status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('No permissions', 'We need media library access to pick an image.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
                const manipResult = await manipulateAsync(
                    result.assets[0].uri,
                    [{resize: {width: 500}}],
                    {compress: 0.8, format: SaveFormat.JPEG}
                );
                setImage(manipResult.uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    const takePhoto = async () => {
        try {
            const {status} = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('No permissions', 'We need camera access to take a photo.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
                const manipResult = await manipulateAsync(
                    result.assets[0].uri,
                    [{resize: {width: 500}}],
                    {compress: 0.8, format: SaveFormat.JPEG}
                );
                setImage(manipResult.uri);
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo. Please try again.');
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Provide your full name');
            return;
        }

        if (!user) {
            Alert.alert('Error', 'User not found');
            router.replace('/auth/login');
            return;
        }

        setIsSubmitting(true);
        try {
            let avatarUrl: string | undefined = undefined;

            if (image) {
                setIsLoading(true);
                const fileName = `avatars/${Date.now()}.jpg`;
                const formData = new FormData();

                // @ts-ignore
                formData.append('file', {
                    uri: image,
                    name: fileName,
                    type: 'image/jpeg',
                });

                const {data: uploadData, error: uploadError} = await supabase.storage
                    .from('avatars')
                    .upload(fileName, formData, {
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (uploadError) throw uploadError;

                const {data: publicUrlData} = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                avatarUrl = publicUrlData.publicUrl;
            }

            try {
                await addPlayer(name, nickname, avatarUrl);
                router.replace({
                    pathname: '/(tabs)',
                    params: {refresh: Date.now()}
                });
            } catch (error) {
                console.error('Error creating player:', error);
                Alert.alert('Error', 'Filed to create player.');
            }
        } catch (error) {
            console.error('Error creating profile:', error);
            Alert.alert('Error', 'Failed to create profile.');
        } finally {
            setIsLoading(false);
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary}/>
                    <Text style={styles.loadingText}>Uploading avatar...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Header z avatarem */}
                <View style={styles.header}>
                    <Text style={styles.title}>Create your profile</Text>

                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            {image ? (
                                <Image source={{uri: image}} style={styles.avatarImage}/>
                            ) : (
                                <Text style={styles.avatarText}>PHOTO</Text>
                            )}
                        </View>

                        <View style={styles.avatarButtons}>
                            <TouchableOpacity style={styles.avatarButton} onPress={pickImage}>
                                <ImageIcon size={20} color={colors.primary}/>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.avatarButton} onPress={takePhoto}>
                                <Camera size={20} color={colors.primary}/>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Sekcja z informacjami */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Provide full name"
                            placeholderTextColor={colors.textLight}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nick Name (optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={nickname}
                            onChangeText={setNickname}
                            placeholder="Provide nick name"
                            placeholderTextColor={colors.textLight}
                        />
                    </View>
                </View>

                {/* Przycisk */}
                <Button
                    title="Save Profile"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    style={styles.button}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 24,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.card,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 3,
        borderColor: colors.primary,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        color: colors.textLight,
        fontWeight: 'bold',
    },
    avatarButtons: {
        flexDirection: 'row',
        marginTop: -25,
        zIndex: 10,
    },
    avatarButton: {
        backgroundColor: colors.card,
        padding: 8,
        borderRadius: 20,
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: colors.border,
    },
    section: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: colors.textLight,
        marginBottom: 4,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    button: {
        marginTop: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: colors.textLight,
    },
});

export default SetupProfileScreen;

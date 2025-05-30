import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Thay Link bằng useNavigate
import Cookies from 'js-cookie';
import './ProfilePage.css';

function ProfilePage({ onProfileUpdated }) { // Thêm prop onProfileUpdated
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        avatar: '',
        github: '',
        linkedin: '',
    });
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
    const [showEmailOnProfile, setShowEmailOnProfile] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const token = Cookies.get('access_token');
    const userId = token ? JSON.parse(atob(token.split('.')[1])).user_id : null;
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserData = async () => {
            if (!token || !userId) {
                setError("Không tìm thấy mã xác thực. Vui lòng đăng nhập.");
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(`http://localhost:8000/api/users/${userId}/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Không thể tải dữ liệu người dùng');
                }

                const data = await response.json();
                setFormData({
                    username: data.username || '',
                    email: data.email || '',
                    avatar: data.avatar || '',
                    github: data.github || '',
                    linkedin: data.linkedin || '',
                });
                setShowEmailOnProfile(data.show_email_on_profile || false);
                setAvatarPreviewUrl(data.avatar || null);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, [token, userId]);

    useEffect(() => {
        return () => {
            if (avatarPreviewUrl) {
                URL.revokeObjectURL(avatarPreviewUrl);
            }
        };
    }, [avatarPreviewUrl]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleAvatarFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError("Vui lòng chọn một tệp hình ảnh.");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setError("Kích thước tệp hình ảnh phải nhỏ hơn 5MB.");
                return;
            }
            setAvatarFile(file);
            const previewUrl = URL.createObjectURL(file);
            if (avatarPreviewUrl) {
                URL.revokeObjectURL(avatarPreviewUrl);
            }
            setAvatarPreviewUrl(previewUrl);
        } else {
            setAvatarFile(null);
            if (avatarPreviewUrl) {
                URL.revokeObjectURL(avatarPreviewUrl);
            }
            setAvatarPreviewUrl(null);
        }
    };

    const validateForm = () => {
        if (!formData.username) return "Tên người dùng là bắt buộc.";
        if (!formData.email) return "Email là bắt buộc.";
        const emailPattern = /^[\w.-]+@[\w.-]+\.\w+$/;
        if (!emailPattern.test(formData.email)) return "Định dạng email không hợp lệ.";
        if (formData.github) {
            const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/;
            if (!githubPattern.test(formData.github)) return "URL Github không hợp lệ.";
        }
        if (formData.linkedin) {
            const linkedinPattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/;
            if (!linkedinPattern.test(formData.linkedin)) return "URL LinkedIn không hợp lệ.";
        }
        return null;
    };

    const handleSaveChangesProfile = async (event) => {
        event.preventDefault();
        if (!token || !userId) {
            setError("Không tìm thấy mã xác thực. Vui lòng đăng nhập.");
            return;
        }

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);

        const formDataToSend = new FormData();
        formDataToSend.append('username', formData.username);
        formDataToSend.append('email', formData.email);
        formDataToSend.append('github', formData.github || '');
        formDataToSend.append('linkedin', formData.linkedin || '');
        formDataToSend.append('show_email_on_profile', showEmailOnProfile);
        if (avatarFile) formDataToSend.append('avatar', avatarFile);

        try {
            const response = await fetch(`http://localhost:8000/api/users/${userId}/update/`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formDataToSend,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Lỗi máy chủ nội bộ');
            }

            const data = await response.json();
            setFormData({
                username: data.data.username,
                email: data.data.email,
                avatar: data.data.avatar,
                github: data.data.github,
                linkedin: data.data.linkedin,
            });
            setShowEmailOnProfile(data.data.show_email_on_profile);
            setAvatarPreviewUrl(data.data.avatar);
            setAvatarFile(null);
            setSuccessMessage(data.message || "Hồ sơ đã được cập nhật thành công.");
            if (data.warning) setError(data.warning);
        } catch (err) {
            setError(`Lỗi khi lưu hồ sơ: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVisitSettings = () => {
        if (onProfileUpdated) {
            onProfileUpdated({}, true); // Gọi với navigateToSettings = true
        }
    };

    return (
        <div className="page-content profile-page-container">
            {error && <p className="error-message" style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
            {successMessage && <p style={{ color: 'green', textAlign: 'center' }}>{successMessage}</p>}
            {isLoading && <p style={{ textAlign: 'center' }}>Đang tải...</p>}

            <div className="profile-header">
                <h2>Hồ sơ kỹ năng</h2>
            </div>
            <p className="profile-description">Tạo hồ sơ kỹ năng của bạn để giới thiệu các kỹ năng của bạn.</p>

            <div className="profile-section">
                <h3>Ảnh đại diện</h3>
                <div className="profile-picture-container">
                    <img
                        src={avatarPreviewUrl || '/creator-ava.png'}
                        alt="Hồ sơ"
                        id="profile-image"
                        className="profile-picture"
                    />
                    <button className="edit-btn" onClick={() => document.getElementById('profile-pic-upload').click()}>Chỉnh sửa</button>
                    <input
                        type="file"
                        id="profile-pic-upload"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleAvatarFileChange}
                    />
                </div>
            </div>

            <div className="profile-section">
                <h3>Tên người dùng<span className="required">*</span></h3>
                <input
                    type="text"
                    className="form-control-us"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                />
            </div>

            <div className="profile-section">
                <h3>Email<span className="required">*</span></h3>
                <div className="email-section">
                    <input
                        type="email"
                        className="form-control-us"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        disabled
                    />
                    <p>
                        <a href="#" onClick={handleVisitSettings} style={{ color: 'purple' }}>
                            Truy cập trang cài đặt để thay đổi email
                        </a>
                    </p>
                    <label>
                        <input
                            type="checkbox"
                            checked={showEmailOnProfile}
                            onChange={(e) => setShowEmailOnProfile(e.target.checked)}
                        /> Hiển thị email của tôi trên hồ sơ
                    </label>
                </div>
            </div>

            <div className="profile-section">
                <h3>Github</h3>
                <input
                    type="url"
                    className="form-control-us"
                    name="github"
                    value={formData.github}
                    onChange={handleInputChange}
                    placeholder="https://github.com/tên-người-dùng"
                />
            </div>

            <div className="profile-section">
                <h3>LinkedIn</h3>
                <input
                    type="url"
                    className="form-control-us"
                    name="linkedin"
                    value={formData.linkedin}
                    onChange={handleInputChange}
                    placeholder="https://www.linkedin.com/in/tên-người-dùng/"
                />
            </div>

            <div className="profile-actions-section" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee', textAlign: 'right' }}>
                <button
                    className="save-profile-btn"
                    onClick={handleSaveChangesProfile}
                    disabled={isLoading}
                >
                    Lưu hồ sơ
                </button>
            </div>
        </div>
    );
}

export default ProfilePage;
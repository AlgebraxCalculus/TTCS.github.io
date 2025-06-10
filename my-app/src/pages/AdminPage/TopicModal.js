import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './TopicModal.css';

function TopicModal({ isVisible, onClose, onCreateNew, onAddExisting, roadmapId, currentLang = 'vi' }) {
  const [newTopicData, setNewTopicData] = useState({
    name: '',
    description: '',
  });
  const [existingTopicsList, setExistingTopicsList] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [existingError, setExistingError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const navigate = useNavigate();
  const { getToken, logout } = useAuth();

  const initialTranslations = useMemo(() => ({
    modalHeader: "Tạo Chủ đề",
    createNewSection: "Tạo chủ đề mới",
    createError: "Tên chủ đề là bắt buộc.",
    noTokenError: "Không tìm thấy mã xác thực. Vui lòng đăng nhập.",
    successMessage: "Chủ đề đã được tạo thành công.",
    newTopicNameLabel: "Tên chủ đề:",
    newTopicDescLabel: "Mô tả:",
    newTopicNamePlaceholder: "Nhập tên chủ đề",
    newTopicDescPlaceholder: "Nhập mô tả",
    creatingButton: "Đang tạo...",
    createButton: "Thêm chủ đề",
    existingSection: "Thêm chủ đề hiện có",
    instruction: "Chọn các chủ đề từ danh sách dưới đây:",
    loadingMessage: "Đang tải các chủ đề hiện có...",
    noTopicsAvailable: "Không có chủ đề nào có sẵn để thêm.",
    selectError: "Vui lòng chọn ít nhất một chủ đề để thêm.",
    addSelectedButton: "Thêm các chủ đề đã chọn",
    selectColumn: "Chọn",
    nameColumn: "Tên",
    descriptionColumn: "Mô tả",
    descriptionNA: "N/A",
  }), []);

  const [translations, setTranslations] = useState(initialTranslations);

  const translateText = useCallback(async (texts, targetLang) => {
    console.log('TopicModal translateText input:', { texts, targetLang });
    try {
      const response = await fetch('http://localhost:8000/api/translate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texts, target_lang: targetLang }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Translate API error in TopicModal:', errorText);
        throw new Error(errorText);
      }
      if (response.status === 401) {
        logout();
        navigate('/');
      }
      const data = await response.json();
      console.log('TopicModal translateText response:', data);
      return data.translated || texts;
    } catch (error) {
      console.error('Translation error in TopicModal:', error);
      if (error.message.includes('401')) {
        logout();
        navigate('/');
      }
      return texts;
    }
  }, [logout, navigate]);

  useEffect(() => {
    console.log('TopicModal useEffect triggered with currentLang:', currentLang);
    const translateContent = async () => {
      console.log('TopicModal initialTranslations:', initialTranslations);
      if (currentLang === 'vi') {
        setTranslations(initialTranslations);
        console.log('TopicModal setTranslations to initial (vi):', initialTranslations);
        return;
      }

      const textsToTranslate = Object.values(initialTranslations);
      console.log('TopicModal textsToTranslate:', textsToTranslate);
      const translatedTexts = await translateText(textsToTranslate, currentLang);
      console.log('TopicModal translatedTexts:', translatedTexts);
      const updatedTranslations = {};
      Object.keys(initialTranslations).forEach((key, index) => {
        updatedTranslations[key] = translatedTexts[index] || initialTranslations[key];
      });
      console.log('TopicModal updatedTranslations:', updatedTranslations);
      setTranslations(updatedTranslations);
    };

    translateContent();
  }, [currentLang, initialTranslations, translateText]);

  useEffect(() => {
    console.log('TopicModal translations state updated:', translations);
  }, [translations]);

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        const exp = decoded.exp;
        const now = Date.now() / 1000;
        if (exp && exp < now) {
          logout();
          navigate('/');
        }
      } catch (error) {
        console.error('Token validation error in TopicModal:', error);
        logout();
        navigate('/');
      }
    }
  }, [getToken, logout, navigate]);

  useEffect(() => {
    if (isVisible) {
      const fetchExistingTopics = async () => {
        setIsLoadingExisting(true);
        setSuccessMessage(null);
        setExistingError(null);
        const token = getToken();
        if (!token) {
          setExistingError(translations.noTokenError);
          setIsLoadingExisting(false);
          return;
        }

        try {
          const topicRoadmapResponse = await fetch('http://localhost:8000/api/topic-roadmap/', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!topicRoadmapResponse.ok) {
            if (topicRoadmapResponse.status === 401) {
              logout();
              navigate('/');
            }
            throw new Error(translations.noTopicsAvailable);
          }

          const topicRoadmapData = await topicRoadmapResponse.json();
          const mappings = topicRoadmapData.data || [];
          const assigned = mappings
            .filter(mapping => mapping.RoadmapID === roadmapId)
            .map(mapping => mapping.TopicID);

          const response = await fetch('http://localhost:8000/api/topics/', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            if (response.status === 401) {
              logout();
              navigate('/');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `${translations.noTopicsAvailable}: ${response.statusText}`);
          }

          const responseData = await response.json();
          console.log('Đã tìm nạp các chủ đề:', responseData);
          let topics = responseData.data || [];
          const availableTopics = topics.filter(topic => !assigned.includes(topic.id));

          if (currentLang !== 'vi') {
            const titles = availableTopics.map(topic => topic.title);
            const descriptions = availableTopics.map(topic => topic.description || 'N/A');
            const textsToTranslate = [...titles, ...descriptions];
            const translatedTexts = await translateText(textsToTranslate, currentLang);

            availableTopics.forEach((topic, index) => {
              topic.title = translatedTexts[index] || topic.title;
              topic.description = translatedTexts[titles.length + index] || (topic.description || 'N/A');
            });
          }

          setExistingTopicsList(availableTopics);
        } catch (err) {
          console.error('Lỗi khi tìm nạp các chủ đề hiện có:', err);
          setExistingError(err.message);
          setExistingTopicsList([]);
        } finally {
          setIsLoadingExisting(false);
        }
      };
      fetchExistingTopics();
    } else {
      setExistingTopicsList([]);
      setSelectedTopics([]);
    }
  }, [isVisible, roadmapId, translations.noTokenError, translations.noTopicsAvailable, getToken, logout, navigate, currentLang, translateText]);

  const handleNewInputChange = (e) => {
    const { name, value } = e.target;
    setNewTopicData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleCreateFormSubmit = async (event) => {
    event.preventDefault();

    if (!newTopicData.name.trim()) {
      setCreateError(translations.createError);
      return;
    }

    const token = getToken();
    if (!token) {
      setCreateError(translations.noTokenError);
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setSuccessMessage(null);

    const payload = {
      title: newTopicData.name,
      description: newTopicData.description,
    };
    console.log('Đang gửi dữ liệu để tạo chủ đề:', payload);

    try {
      const response = await fetch('http://localhost:8000/api/topics/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          navigate('/');
        }
        const errorData = await response.json().catch(() => ({}));
        console.log('Phản hồi lỗi API:', errorData);
        throw new Error(errorData.detail || errorData.message || `Không thể tạo chủ đề: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Dữ liệu chủ đề đã tạo:', data);
      const createdTopic = data.data;
      setSuccessMessage(data.message || translations.successMessage);

      setTimeout(() => {
        if (onCreateNew) {
          onCreateNew(createdTopic);
        }
        setNewTopicData({ name: '', description: '' });
        onClose();
      }, 3000);
    } catch (err) {
      console.error('Lỗi tạo chủ đề:', err);
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleTopicSelection = (topicId) => {
    setSelectedTopics(prev => {
      if (prev.includes(topicId)) {
        return prev.filter(id => id !== topicId);
      } else {
        return [...prev, topicId];
      }
    });
  };

  const handleAddExistingSubmit = () => {
    if (selectedTopics.length === 0) {
      setExistingError(translations.selectError);
      return;
    }

    const topicsToAdd = existingTopicsList.filter(topic => selectedTopics.includes(topic.id));
    console.log("Đang thêm các chủ đề hiện có đã chọn:", topicsToAdd);

    if (onAddExisting) {
      onAddExisting(topicsToAdd);
    }
  };

  const handleCancelOrClose = () => {
    setNewTopicData({ name: '', description: '' });
    setSelectedTopics([]);
    setCreateError(null);
    setSuccessMessage(null);
    setExistingError(null);
    onClose();
  };

  const renderExistingTopicsTable = () => {
    const topicsToDisplay = existingTopicsList.length > 0 ? existingTopicsList : [];

    if (isLoadingExisting) {
      return <p style={{ textAlign: 'center' }}>{translations.loadingMessage}</p>;
    }
    if (existingError) {
      return <p style={{ textAlign: 'center', color: 'red' }}>{existingError}</p>;
    }
    if (topicsToDisplay.length === 0) {
      return <p style={{ textAlign: 'center' }}>{translations.noTopicsAvailable}</p>;
    }

    return (
      <div className="topic-table-container">
        <table className="topic-table">
          <thead>
            <tr>
              <th>{translations.selectColumn}</th>
              <th>#</th>
              <th>{translations.nameColumn}</th>
              <th>{translations.descriptionColumn}</th>
            </tr>
          </thead>
          <tbody>
            {topicsToDisplay.map((topic, index) => (
              <tr key={topic.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedTopics.includes(topic.id)}
                    onChange={() => handleTopicSelection(topic.id)}
                  />
                </td>
                <td>{index + 1}</td>
                <td>{topic.title}</td>
                <td>{topic.description === 'N/A' ? translations.descriptionNA : topic.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={handleCancelOrClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{translations.modalHeader}</h3>
          <button className="modal-close-btn" onClick={handleCancelOrClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="topic-creation-section">
            <h4>{translations.createNewSection}</h4>
            {createError && <p style={{ color: 'red', textAlign: 'center' }}>{createError}</p>}
            {successMessage && <p style={{ color: 'green', textAlign: 'center' }}>{successMessage}</p>}
            <form onSubmit={handleCreateFormSubmit}>
              <div className="form-group">
                <label htmlFor="new-topic-name">{translations.newTopicNameLabel}</label>
                <input
                  type="text"
                  className="form-control-us"
                  id="new-topic-name"
                  name="name"
                  placeholder={translations.newTopicNamePlaceholder}
                  required
                  value={newTopicData.name}
                  onChange={handleNewInputChange}
                  disabled={isCreating}
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-topic-desc">{translations.newTopicDescLabel}</label>
                <textarea
                  className="form-control-us"
                  id="new-topic-desc"
                  name="description"
                  placeholder={translations.newTopicDescPlaceholder}
                  rows="4"
                  value={newTopicData.description}
                  onChange={handleNewInputChange}
                  disabled={isCreating}
                ></textarea>
              </div>
              <div className="modal-actions">
                <button type="submit" className="create-btn" disabled={isCreating}>
                  {isCreating ? translations.creatingButton : translations.createButton}
                </button>
              </div>
            </form>
          </div>
          <div className="topic-divider"></div>
          <div className="topic-existing-section">
            <h4>{translations.existingSection}</h4>
            <p className="section-instruction">{translations.instruction}</p>
            {renderExistingTopicsTable()}
            <div className="modal-actions">
              <button type="button" className="create-btn" onClick={handleAddExistingSubmit}>{translations.addSelectedButton}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopicModal;
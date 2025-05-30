import React, { useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import './RoadmapsPage.css';
import RoadmapModal from './RoadmapModal';
import Pagination from '../../components/Pagination/Pagination';

function RoadmapsPage({ onEditRoadmap, onRoadmapDeleted }) {
  const [roadmaps, setRoadmaps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [totalRoadmaps, setTotalRoadmaps] = useState(0);

  const fetchRoadmaps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const token = Cookies.get('access_token');
    if (!token) {
      setError("Không tìm thấy mã thông báo xác thực. Vui lòng đăng nhập.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8000/api/roadmaps/?page=${currentPage}&page_size=${itemsPerPage}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Không thể tìm nạp lộ trình: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Phản hồi API:', data);

      // Truy cập đúng vào data.results.data để lấy danh sách roadmaps
      const roadmapData = data.results && data.results.data ? data.results.data : [];
      setRoadmaps(roadmapData);
      setTotalRoadmaps(data.count || 0);
    } catch (err) {
      console.error('Lỗi khi tìm nạp lộ trình:', err);
      setError(err.message);
      setRoadmaps([]);
      setTotalRoadmaps(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    fetchRoadmaps();
  }, [fetchRoadmaps]);

  const handlePageChange = (pageNumber) => {
    const lastPage = Math.ceil(totalRoadmaps / itemsPerPage);
    if (pageNumber > 0 && pageNumber <= lastPage && pageNumber !== currentPage) {
      setCurrentPage(pageNumber);
    } else if (pageNumber > lastPage && lastPage >= 1) {
      setCurrentPage(lastPage);
    } else if (lastPage === 0 && pageNumber === 1) {
      setCurrentPage(1);
    }
  };

  const handleCreateButtonClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleRoadmapCreated = (newRoadmap) => {
    setRoadmaps(prevRoadmaps => [...prevRoadmaps, newRoadmap]);
    setTotalRoadmaps(prevTotal => prevTotal + 1);
    setIsCreateModalOpen(false);
  };

  const handleDeleteRoadmap = (roadmapId) => {
    setRoadmaps(prevRoadmaps => prevRoadmaps.filter(roadmap => roadmap.id !== roadmapId));
    setTotalRoadmaps(prevTotal => prevTotal - 1);
    if (onRoadmapDeleted) {
      onRoadmapDeleted(roadmapId);
    }
  };

  const handleEditClick = (roadmapId) => {
    if (onEditRoadmap) {
      onEditRoadmap(roadmapId);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return <div style={{ textAlign: 'center' }}>Đang tải lộ trình...</div>;
    }

    if (error) {
      return <div className="error-message" style={{ textAlign: 'center', color: 'red' }}>{error}</div>;
    }

    if (roadmaps.length === 0) {
      return (
        <div className="no-roadmaps">
          <div className="roadmap-icon">
            <i className="fa-solid fa-signs-post"></i>
          </div>
          <h2>Chưa có lộ trình nào</h2>
          <p>Tạo một lộ trình để bắt đầu</p>
        </div>
      );
    }

    return (
      <div className="roadmap-list">
        {roadmaps.map((roadmap) => (
          <div key={roadmap.id} className="roadmap-list-item">
            <div className="item-details">
              <span className="item-title">{roadmap.title}</span>
              <span className="item-stats">{roadmap.description || 'Không có mô tả'}</span>
            </div>
            <div className="item-actions">
              {onEditRoadmap && (
                <button
                  className="action-btn edit-btn"
                  onClick={() => handleEditClick(roadmap.id)}
                >
                  Sửa
                </button>
              )}
              <button
                className="action-btn delete-btn"
                onClick={() => handleDeleteRoadmap(roadmap.id)}
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
        {totalRoadmaps > itemsPerPage && (
          <Pagination
            totalItems={totalRoadmaps}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    );
  };

  return (
    <div className="page-content" id="roadmaps">
      <div className="roadmap-container">
        <div className="roadmap-tabs">
          <h2>Quản lý lộ trình</h2>
          <button
            className="create-roadmap-btn"
            onClick={handleCreateButtonClick}
          >
            + Tạo Lộ trình
          </button>
        </div>

        {renderContent()}

        <RoadmapModal
          isVisible={isCreateModalOpen}
          onClose={handleCloseCreateModal}
          onRoadmapCreated={handleRoadmapCreated}
        />
      </div>
    </div>
  );
}

export default RoadmapsPage;
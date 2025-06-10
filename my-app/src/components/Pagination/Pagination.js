import React from 'react';
import './Pagination.css'; // Import file CSS tương ứng

// Component phân trang chung
// Nhận các props: tổng số mục, số mục mỗi trang, trang hiện tại, và các hàm callback
function Pagination({
    totalItems,
    itemsPerPage,
    currentPage,
    onPageChange,
    onPreviousPage,
    onNextPage,
}) {
    // Tính tổng số trang
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Tạo mảng các số trang để render nút
    // Hiển thị Previous, Next, và một vài số trang xung quanh trang hiện tại
    const pageNumbers = [];
    const maxPageButtons = 5; // Số nút số trang tối đa hiển thị

    // Logic tạo các nút số trang
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    if (endPage - startPage + 1 < maxPageButtons) {
        startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
    }

    return (
        <div className="pagination"> {/* Sử dụng className */}
            {/* Hiển thị thông tin phân trang */}
            <div className="pagination-info"> {/* Sử dụng className */}
                Showing <strong>{Math.min(currentPage * itemsPerPage, totalItems)}</strong> out of <strong>{totalItems}</strong> entries
            </div>
            {/* Các nút điều hướng trang */}
            <div className="pagination-controls"> {/* Sử dụng className */}

                {/* Nút Previous - disabled nếu đang ở trang đầu tiên */}
                <button
                    className="pagination-btn" 
                    onClick={onPreviousPage}
                    disabled={currentPage === 1}
                >
                    Previous
                </button>

                {/* Render các nút số trang */}
                {pageNumbers.map(number => (
                    <button
                        key={number} // Key duy nhất cho mỗi nút trong list
                        className={`pagination-btn ${number === currentPage ? 'active' : ''}`} // Thêm class active nếu đúng trang hiện tại
                        onClick={() => onPageChange(number)} // Gọi onPageChange với số trang tương ứng
                    >
                        {number}
                    </button>
                ))}

                {/* Nút Next - disabled nếu đang ở trang cuối cùng */}
                <button
                    className="pagination-btn" 
                    onClick={onNextPage}
                    disabled={currentPage === totalPages}
                >
                    Next
                </button>
            </div>
        </div>
    );
}

export default Pagination;
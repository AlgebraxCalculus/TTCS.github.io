from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.generics import CreateAPIView, ListAPIView, RetrieveAPIView
from .models import User
from UserVisitLog.views import record_user_visit
from .serializers import (
    UserSerializer, SocialUserSerializer, LoginSerializer,
    EmailLoginSerializer, ResetPasswordEmailSerializer, ResetPasswordSerializer
)
from rest_framework_simplejwt.tokens import RefreshToken
import cloudinary.uploader
from rest_framework.parsers import MultiPartParser, FormParser
from .permissions import IsAdmin, IsAdminOrUser, CanAccessOwnUserData
from rest_framework.authentication import SessionAuthentication
from rest_framework.pagination import PageNumberPagination
import logging
import re
from django.core.exceptions import ObjectDoesNotExist

logger = logging.getLogger(__name__)

class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return  # Bỏ qua kiểm tra CSRF

class RegisterView(CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {"detail": f"Lỗi khi đăng ký: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

class SocialRegisterView(CreateAPIView):
    queryset = User.objects.all()
    serializer_class = SocialUserSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {"detail": f"Lỗi khi đăng ký social: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])

            # Ghi nhận lượt truy cập
            record_user_visit(user)

            tokens = get_tokens_for_user(user)
            return Response({
                'message': 'Đăng nhập thành công',
                'username': user.username,
                'email': user.email,
                'avatar': user.avatar or 'https://res.cloudinary.com/dsm1uhecl/image/upload/v1744875601/ptitLogo_x3gko8.png',
                'tokens': tokens,
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

class SocialLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = EmailLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])

            # Ghi nhận lượt truy cập
            record_user_visit(user)

            tokens = get_tokens_for_user(user)
            return Response({
                'message': 'Đăng nhập thành công qua email (xác thực social)',
                'username': user.username,
                'email': user.email,
                'tokens': tokens
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ResetPasswordEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordEmailSerializer(data=request.data)
        if serializer.is_valid():
            user = User.objects.get(email=serializer.validated_data['email'])
            serializer.send_reset_link(user)
            return Response(
                {"detail": "Đường link đặt lại mật khẩu đã được gửi qua email."},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"detail": "Mật khẩu đã được thay đổi thành công."},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    
    refresh['user_id'] = str(user.id)
    refresh['role'] = user.role  

    access_token = refresh.access_token
    access_token['user_id'] = str(user.id)
    access_token['role'] = user.role  

    logger.info(f"[Token] Generated token for user_id: {user.id}, role: {user.role}")
    
    return {
        'refresh': str(refresh),
        'access': str(access_token),
    }

class CustomPagination(PageNumberPagination):
    page_size = 5  # Số mục mặc định trên mỗi trang, khớp với frontend
    page_size_query_param = 'page_size'  # Tùy chỉnh số mục qua query param
    max_page_size = 20  # Giới hạn tối đa số mục trên một trang
    page_query_param = 'page'  # Tên tham số cho số trang

class UserListView(ListAPIView):
    queryset = User.objects.order_by('username')
    serializer_class = UserSerializer
    authentication_classes = []
    permission_classes = [IsAdmin]
    pagination_class = CustomPagination  # Thêm phân trang

    def get(self, request, *args, **kwargs):
        try:
            # Gọi phương thức get của ListAPIView để xử lý phân trang
            return super().get(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {"detail": f"Lỗi khi lấy danh sách user: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class UserDetailView(RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    lookup_field = 'id'
    authentication_classes = []  # Middleware xử lý xác thực
    permission_classes = [IsAdminOrUser, CanAccessOwnUserData]

    def get_object(self):
        user_id = self.kwargs.get(self.lookup_field)
        logger.info(f"Processing get_object - URL user_id: {user_id}")

        # Lấy thông tin từ middleware
        auth_user = getattr(self.request, 'auth_user', None)
        if not auth_user:
            logger.error("No auth_user found in request")
            return Response(
                {'success': False, 'message': 'Authentication data not available'},
                status=401
            )

        auth_user_id = auth_user.get('_id')
        auth_user_role = auth_user.get('role', '').lower()
        logger.info(f"Authenticated user: user_id={auth_user_id}, role={auth_user_role}")

        # Debug thông tin
        logger.info(f"Token user_id: {auth_user_id}, URL user_id: {user_id}")

        # Nếu là admin, trả về user từ URL
        if auth_user_role == 'admin':
            logger.info(f"Admin access granted for user_id: {user_id}")
            try:
                return User.objects.get(id=user_id)
            except ObjectDoesNotExist:
                logger.error(f"User with id {user_id} not found in database")
                return Response(
                    {'success': False, 'message': 'User not found'},
                    status=404
                )

        # Nếu là user, chỉ cho phép truy cập chính mình
        if str(auth_user_id) != str(user_id):
            logger.warning(f"User {auth_user_id} attempted to access data of user {user_id}")
            return Response(
                {'success': False, 'message': 'You can only access your own data'},
                status=403
            )

        # Trả về user từ database dựa trên auth_user_id
        try:
            user = User.objects.get(id=auth_user_id)
            logger.info(f"Retrieved user from DB: {user}")
            return user
        except ObjectDoesNotExist:
            logger.error(f"User with id {auth_user_id} not found in database")
            return Response(
                {'success': False, 'message': 'User not found'},
                status=404
            )

class UserDeleteView(APIView):
    authentication_classes = []
    permission_classes = [IsAdminOrUser, CanAccessOwnUserData]

    def delete(self, request, id):
        try:
            user_to_delete = User.objects.get(id=id)
        except User.DoesNotExist:
            return Response({"detail": "Người dùng không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

        authenticated_user_id = request.auth_user['_id']
        user_role = request.auth_user['role']

        if user_role != 'admin':
            return Response({"detail": "Chỉ admin mới được phép xóa tài khoản."}, status=status.HTTP_403_FORBIDDEN)

        if str(authenticated_user_id) == str(id):
            return Response({"detail": "Admin không thể tự xóa tài khoản của chính mình."}, status=status.HTTP_403_FORBIDDEN)

        if user_to_delete.role == 'admin':
            return Response({"detail": "Admin không thể xóa tài khoản admin khác."}, status=status.HTTP_403_FORBIDDEN)

        user_to_delete.delete()
        return Response({"message": "Xóa người dùng thành công."}, status=status.HTTP_204_NO_CONTENT)

class UserUpdateView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    authentication_classes = []
    permission_classes = [IsAdminOrUser, CanAccessOwnUserData]

    def put(self, request, id):
        try:
            user = User.objects.get(id=id)
        except User.DoesNotExist:
            return Response({"detail": "Người dùng không tồn tại."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        avatar_updated = False

        # Validation
        if 'username' in data:
            if not data['username']:
                return Response({"detail": "Username không được để trống."}, status=status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(username=data['username']).exclude(id=id).exists():
                return Response({"detail": "Username đã tồn tại."}, status=status.HTTP_400_BAD_REQUEST)
            user.username = data['username']

        if 'email' in data:
            if not data['email']:
                return Response({"detail": "Email không được để trống."}, status=status.HTTP_400_BAD_REQUEST)
            email_pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
            if not re.match(email_pattern, data['email']):
                return Response({"detail": "Email không đúng định dạng."}, status=status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(email=data['email']).exclude(id=id).exists():
                return Response({"detail": "Email đã tồn tại."}, status=status.HTTP_400_BAD_REQUEST)
            user.email = data['email']

        if 'password' in data:
            user.set_password(data['password'])

        if 'github' in data:
            if data['github']:
                url_pattern = r'^https?://(www\.)?github\.com/[\w-]+/?$'
                if not re.match(url_pattern, data['github']):
                    return Response({"detail": "Github URL không đúng định dạng."}, status=status.HTTP_400_BAD_REQUEST)
            user.github = data['github']

        if 'linkedin' in data:
            if data['linkedin']:
                url_pattern = r'^https?://(www\.)?linkedin\.com/in/[\w-]+/?$'
                if not re.match(url_pattern, data['linkedin']):
                    return Response({"detail": "LinkedIn URL không đúng định dạng."}, status=status.HTTP_400_BAD_REQUEST)
            user.linkedin = data['linkedin']

        if 'show_email_on_profile' in data:
            show_email = data['show_email_on_profile']
            if isinstance(show_email, str):
                show_email = show_email.lower() == 'true'
            elif show_email not in [True, False]:
                return Response({"detail": "show_email_on_profile phải là true hoặc false."}, status=status.HTTP_400_BAD_REQUEST)
            user.show_email_on_profile = bool(show_email)

        if 'avatar' in request.FILES:
            avatar_file = request.FILES['avatar']
            try:
                logger.info(f"Uploading avatar for user {id}: {avatar_file.name}, size: {avatar_file.size}")
                result = cloudinary.uploader.upload(avatar_file)
                if 'secure_url' not in result:
                    logger.error("Cloudinary upload failed: No secure_url in response")
                    return Response(
                        {"detail": "Lỗi khi tải ảnh lên Cloudinary: Không nhận được URL ảnh"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
                user.avatar = result['secure_url']
                avatar_updated = True
                logger.info(f"Avatar uploaded successfully: {user.avatar}")
            except Exception as e:
                logger.error(f"Error uploading avatar to Cloudinary: {str(e)}")
                return Response(
                    {"detail": f"Lỗi khi tải ảnh lên Cloudinary: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        try:
            user.save()
        except Exception as e:
            logger.error(f"Error saving user to database: {str(e)}")
            return Response(
                {"detail": f"Lỗi khi lưu dữ liệu: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        serializer = UserSerializer(user)
        response_data = {
            "message": "Cập nhật thông tin người dùng thành công.",
            "data": serializer.data
        }
        if 'avatar' in request.FILES and not avatar_updated:
            response_data["warning"] = "Ảnh avatar không được cập nhật do lỗi upload."
        return Response(response_data)
'use client';

import { useState, useEffect } from 'react';
import { Search, Users, Shield, User as UserIcon, Calendar } from 'lucide-react';
import { getCustomers, getCustomerStats } from '@/lib/actions/customers';
import { Profile } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalAdmins: 0,
    totalUsers: 0,
    recentSignups: 0,
  });

  useEffect(() => {
    loadCustomers();
    loadStats();
  }, [page]);

  useEffect(() => {
    // Reset to page 1 when search changes
    if (page === 1) {
      loadCustomers();
    } else {
      setPage(1);
    }
  }, [search]);

  const loadCustomers = async () => {
    setIsLoading(true);
    const result = await getCustomers(page, 20, search);

    if (result.success && result.data) {
      setCustomers(result.data.data);
      setTotal(result.data.total);
      setTotalPages(result.data.totalPages);
    }

    setIsLoading(false);
  };

  const loadStats = async () => {
    const result = await getCustomerStats();
    if (result.success && result.data) {
      setStats(result.data);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: tr,
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Müşteriler</h1>
        <p className="text-gray-500 mt-1">Tüm kayıtlı kullanıcıları görüntüleyin ve yönetin</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Müşteri</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalCustomers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Kullanıcılar</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-elite-gold/20 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-elite-gold" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Yöneticiler</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalAdmins}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Son 30 Gün</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.recentSignups}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim veya e-posta ile ara..."
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg
                     focus:ring-2 focus:ring-elite-gold/20 focus:border-elite-gold
                     transition-colors outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">
                  Müşteri
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">
                  E-posta
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">
                  Telefon
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">
                  Rol
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">
                  Kayıt Tarihi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="w-5 h-5 border-2 border-elite-gold border-t-transparent rounded-full animate-spin" />
                      Yükleniyor...
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {search ? 'Arama sonucu bulunamadı' : 'Henüz müşteri bulunmuyor'}
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-elite-gold/20 rounded-full flex items-center justify-center">
                          <span className="text-elite-gold font-medium text-sm">
                            {getInitials(customer.full_name)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {customer.full_name || 'İsimsiz Kullanıcı'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-600">{customer.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-600">{customer.phone || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {customer.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-elite-gold/20 text-elite-gold rounded-full text-sm font-medium">
                          <Shield className="w-3.5 h-3.5" />
                          Yönetici
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                          <UserIcon className="w-3.5 h-3.5" />
                          Kullanıcı
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-600 text-sm">
                        {formatDate(customer.created_at)}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Toplam {total} müşteriden {(page - 1) * 20 + 1} -{' '}
                {Math.min(page * 20, total)} arası gösteriliyor
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium
                           hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                >
                  Önceki
                </button>

                <span className="px-4 py-2 text-sm text-gray-600">
                  Sayfa {page} / {totalPages}
                </span>

                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium
                           hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

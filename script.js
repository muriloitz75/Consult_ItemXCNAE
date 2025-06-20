// script.js extraído de index.html
const { useState, useEffect, useCallback, useMemo } = React;

// Hook personalizado para debounce
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        // Se o delay for 0, atualize imediatamente sem timeout
        if (delay === 0) {
            setDebouncedValue(value);
            return;
        }
        
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

function App() {
    // Estados principais
    const [data, setData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchCode, setSearchCode] = useState('');
    const [searchService, setSearchService] = useState('');
    const [searchCnaeCode, setSearchCnaeCode] = useState('');
    const [searchCnaeDesc, setSearchCnaeDesc] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [advancedMode, setAdvancedMode] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('todos');
    const [noResults, setNoResults] = useState(false);
    const [history, setHistory] = useState([]);
    const [viewMode, setViewMode] = useState('cards'); // 'cards' ou 'table'
    const [sortField, setSortField] = useState('');
    const [sortDirection, setSortDirection] = useState('asc');


    // Debounced values
    const debouncedSearch = useDebounce(searchTerm, 300);
    const debouncedCode = useDebounce(searchCode, 300);
    const debouncedService = useDebounce(searchService, 300);
    const debouncedCnaeCode = useDebounce(searchCnaeCode, 300);
    const debouncedCnaeDesc = useDebounce(searchCnaeDesc, 300);


    // Carrega dados do XML
    useEffect(() => {
        const loadData = async () => {
            try {
                const response = await fetch('./dados.xml');
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                
                // Extrair dados das linhas da tabela
                const rows = xmlDoc.querySelectorAll('TR');
                const parsedData = [];
                
                rows.forEach(row => {
                    const cells = row.querySelectorAll('TH, TD');
                    if (cells.length >= 4) {
                        const listLC = cells[0].textContent.trim();
                        const descricaoItem = cells[1].textContent.trim();
                        const cnae = cells[2].textContent.trim();
                        const descricaoCnae = cells[3].textContent.trim();
                        
                        if (listLC && descricaoItem && cnae && descricaoCnae) {
                            // Filtrar o registro que contém os nomes dos campos
                            if (descricaoItem !== "Descrição item da lista da Lei Complementar nº 001/2003 - CTM") {
                                parsedData.push({
                                    "LIST LC": listLC,
                                    "Descrição item da lista da Lei Complementar nº 001/2003 - CTM": descricaoItem,
                                    "CNAE": cnae,
                                    "Descrição do CNAE": descricaoCnae
                                });
                            }
                        }
                    }
                });
                
                setData(parsedData);
            } catch (error) {
                console.error('Erro ao carregar dados XML:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // Carrega preferências do localStorage
    useEffect(() => {
        const savedDarkMode = localStorage.getItem('darkMode');
        const savedHistory = localStorage.getItem('searchHistory');
        
        if (savedDarkMode) {
            setDarkMode(JSON.parse(savedDarkMode));
        }
        if (savedHistory) {
            setHistory(JSON.parse(savedHistory));
        }
    }, []);

    // Salva preferências no localStorage
    useEffect(() => {
        localStorage.setItem('darkMode', JSON.stringify(darkMode));
    }, [darkMode]);

    useEffect(() => {
        if (debouncedSearch && debouncedSearch.length >= 3) {
            const newHistory = [debouncedSearch, ...history.filter(h => h !== debouncedSearch)].slice(0, 5);
            setHistory(newHistory);
            localStorage.setItem('searchHistory', JSON.stringify(newHistory));
        }
    }, [debouncedSearch]);

    // Sugestões de autocomplete removidas conforme solicitado

    // Função de filtro principal
    const filterData = useCallback(() => {
        if (!data.length) return [];
        
        let results = [...data];
        
        if (advancedMode) {
            if (debouncedCode) {
                const code = debouncedCode;
                if (code.includes('.')) {
                    results = results.filter(item => item["LIST LC"].toString().toLowerCase() === code);
                } else {
                    results = results.filter(item => item["LIST LC"].toString().toLowerCase().startsWith(code));
                }
            }

            if (debouncedService) {
                const term = debouncedService.toLowerCase();
                results = results.filter(item =>
                    item["Descrição item da lista da Lei Complementar nº 001/2003 - CTM"].toLowerCase().includes(term)
                );
            }

            if (debouncedCnaeCode && /^\d+$/.test(debouncedCnaeCode)) {
                const start = debouncedCnaeCode.substring(0, 2);
                results = results.filter(item =>
                    item.CNAE.toString().replace(/\D/g, '').startsWith(start)
                );
            }

            if (debouncedCnaeDesc) {
                const term = debouncedCnaeDesc.toLowerCase();
                results = results.filter(item =>
                    item["Descrição do CNAE"].toLowerCase().includes(term)
                );
            }
        }
        // Modo universal
        else {
            if (!debouncedSearch) return results;

            const isNumeric = /^\d+$/.test(debouncedSearch);
            const hasDot = debouncedSearch.includes('.');
            const fullCnaeMatch = debouncedSearch.replace(/\D/g, '');

            // Busca por LIST LC (códigos com ponto ou números puros)
            if (hasDot) {
                // Busca flexível para códigos com ponto (ex: "1.01" encontra "01.01")
                const searchLower = debouncedSearch.toLowerCase();
                results = results.filter(item => {
                    const itemCode = item["LIST LC"].toString().toLowerCase();
                    // Busca exata primeiro
                    if (itemCode === searchLower) return true;
                    // Se não encontrou, tenta com zeros à esquerda e direita
                    const parts = searchLower.split('.');
                    if (parts.length === 2) {
                        const paddedCode = parts[0].padStart(2, '0') + '.' + parts[1].padEnd(2, '0');
                        return itemCode === paddedCode;
                    }
                    return false;
                });
            }
            // Busca por CNAE (apenas números com pelo menos 2 dígitos)
            else if (isNumeric && debouncedSearch.length >= 2) {
                // Para números de 2 dígitos, busca por prefixo CNAE
                if (debouncedSearch.length === 2) {
                    results = results.filter(item =>
                        item.CNAE.toString().replace(/\D/g, '').startsWith(debouncedSearch)
                    );
                }
                // Para números maiores, busca mais específica
                else {
                    results = results.filter(item => {
                        const cnaeClean = item.CNAE.toString().replace(/\D/g, '');
                        return cnaeClean.startsWith(debouncedSearch) || cnaeClean === fullCnaeMatch;
                    });
                }
            }
            // Busca por LIST LC sem ponto (ex: "1" para encontrar "1.01", "1.02", etc.)
            else if (isNumeric && debouncedSearch.length === 1) {
                results = results.filter(item =>
                    item["LIST LC"].toString().startsWith(debouncedSearch + '.')
                );
            }
            // Busca por descrição do serviço (texto)
            else if (!isNumeric && debouncedSearch.length >= 3) {
                // Busca mais específica: deve conter o termo completo
                // Garantir que a busca seja case-insensitive
                const searchLower = debouncedSearch.toLowerCase();
                results = results.filter(item => {
                    const desc = item["Descrição item da lista da Lei Complementar nº 001/2003 - CTM"].toLowerCase();
                    const cnaeDesc = item["Descrição do CNAE"].toLowerCase();
                    return desc.includes(searchLower) || cnaeDesc.includes(searchLower);
                });
            }
            // Para buscas muito curtas (1-2 caracteres de texto), não retorna resultados
            else if (!isNumeric && debouncedSearch.length < 3) {
                results = [];
            }
        }

        // Filtro por categoria
        if (categoryFilter === 'servicos') {
            // Filtro para Serviços: prioriza buscas relacionadas a LIST LC e descrições de serviços
            if (debouncedSearch) {
                const isNumeric = /^\d+$/.test(debouncedSearch);
                const hasDot = debouncedSearch.includes('.');
                
                // Se for busca numérica, deve ser relacionada a LIST LC
                if (isNumeric || hasDot) {
                    // Mantém apenas resultados que correspondem a códigos LIST LC
                    const searchLower = debouncedSearch.toLowerCase();
                    results = results.filter(item => {
                        const listLC = item["LIST LC"].toString().toLowerCase();
                        return hasDot ? listLC === searchLower : listLC.startsWith(searchLower + '.');
                    });
                } else {
                    // Para texto, foca na descrição do serviço
                    results = results.filter(item => {
                        const serviceDesc = item["Descrição item da lista da Lei Complementar nº 001/2003 - CTM"].toLowerCase();
                        return serviceDesc.includes(debouncedSearch);
                    });
                }
            }
        } else if (categoryFilter === 'cnaes') {
            // Filtro para CNAEs: prioriza buscas relacionadas a códigos CNAE e suas descrições
            if (debouncedSearch) {
                const isNumeric = /^\d+$/.test(debouncedSearch);
                
                if (isNumeric) {
                    // Para números, busca por códigos CNAE
                    results = results.filter(item => {
                        const cnaeClean = item.CNAE.toString().replace(/\D/g, '');
                        return cnaeClean.startsWith(debouncedSearch);
                    });
                } else {
                    // Para texto, foca na descrição do CNAE
                    results = results.filter(item => {
                        const cnaeDesc = item["Descrição do CNAE"].toLowerCase();
                        return cnaeDesc.includes(debouncedSearch);
                    });
                }
            }
        }
        // Para 'todos', não aplica filtro adicional (comportamento atual mantido)

        setNoResults(results.length === 0 && !isLoading);
        return results;
    }, [data, advancedMode, debouncedSearch, debouncedCode, debouncedService, debouncedCnaeCode, debouncedCnaeDesc, categoryFilter, isLoading]);

    const filteredData = useMemo(filterData, [filterData]);

    // Exporta resultados como CSV
    const exportToCSV = () => {
        const csvContent = [
            ["LIST LC", "Descrição Serviço", "CNAE", "Descrição CNAE"].join(","),
            ...filteredData.map(item =>
                Object.values(item).slice(0, 4).map(val => `"${val}"`).join(",")
            )
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "resultados.csv");
        link.click();
    };

    return (
        <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-900'}`}>
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <header className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        Consulta de Serviços & CNAEs
                    </h1>
                    <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Ferramenta intuitiva para profissionais fiscais e contábeis
                    </p>
                </header>

                {/* Toggle Dark Mode */}
                <div className="flex justify-end mb-4">
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-800 shadow'}`}
                    >
                        {darkMode ? (
                            <>
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                Modo Claro
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                                Modo Escuro
                            </>
                        )}
                    </button>
                </div>

                {/* Seletor de Categoria */}
                <div className="mb-4 flex justify-center space-x-2">
                    <button
                        onClick={() => setCategoryFilter('todos')}
                        className={`px-4 py-2 rounded-md ${
                            categoryFilter === 'todos'
                                ? 'bg-blue-600 text-white'
                                : `${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800 shadow'}`
                        }`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setCategoryFilter('servicos')}
                        className={`px-4 py-2 rounded-md ${
                            categoryFilter === 'servicos'
                                ? 'bg-blue-600 text-white'
                                : `${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800 shadow'}`
                        }`}
                    >
                        Serviços
                    </button>
                    <button
                        onClick={() => setCategoryFilter('cnaes')}
                        className={`px-4 py-2 rounded-md ${
                            categoryFilter === 'cnaes'
                                ? 'bg-blue-600 text-white'
                                : `${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800 shadow'}`
                        }`}
                    >
                        CNAEs
                    </button>
                </div>

                {/* Botão Limpar Filtros */}
                <div className="mb-4 flex justify-center">
                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setSearchCode('');
                            setSearchService('');
                            setSearchCnaeCode('');
                            setSearchCnaeDesc('');
                            setCategoryFilter('todos');
                            setAdvancedMode(false);
                            setHistory([]);
                            localStorage.removeItem('searchHistory');
                        }}
                        className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                            darkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                        } transition-colors duration-200`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Limpar Filtros
                    </button>
                </div>

                {/* Search Form */}
                <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-6 mb-8 card-hover`}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {advancedMode ? 'Busca Avançada' : 'Busca Universal'}
                        </h2>
                        <button
                            onClick={() => setAdvancedMode(!advancedMode)}
                            className={`text-sm px-3 py-1 rounded ${
                                advancedMode
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                        >
                            {advancedMode ? 'Voltar ao Básico' : 'Modo Avançado'}
                        </button>
                    </div>

                    {!advancedMode && (
                        <>
                            <div className="relative group">
                                <input
                                    type="text"
                                    placeholder="Buscar por serviço, código ou CNAE..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors duration-200 ${
                                        darkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500' : 'border-gray-300 focus:ring-blue-500'
                                    }`}
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Autocomplete removido conforme solicitado */}

                            {/* Histórico */}
                            {history.length > 0 && (
                                <div className={`mt-4 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <strong>Histórico:</strong>{' '}
                                    {history.map((term, i) => (
                                        <span key={i} className="mx-1 cursor-pointer underline hover:text-blue-500" onClick={() => setSearchTerm(term)}>
                                            {term}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {advancedMode && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Código do Item</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 1.01"
                                    value={searchCode}
                                    onChange={(e) => setSearchCode(e.target.value)}
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                        darkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500' : 'border-gray-300 focus:ring-blue-500'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Descrição do Serviço</label>
                                <input
                                    type="text"
                                    placeholder="Digite parte da descrição"
                                    value={searchService}
                                    onChange={(e) => setSearchService(e.target.value)}
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                        darkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500' : 'border-gray-300 focus:ring-blue-500'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Código CNAE</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 61"
                                    value={searchCnaeCode}
                                    onChange={(e) => setSearchCnaeCode(e.target.value.replace(/[^0-9]/g, ''))}
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                        darkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500' : 'border-gray-300 focus:ring-blue-500'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Descrição do CNAE</label>
                                <input
                                    type="text"
                                    placeholder="Parte da descrição"
                                    value={searchCnaeDesc}
                                    onChange={(e) => setSearchCnaeDesc(e.target.value)}
                                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                        darkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500' : 'border-gray-300 focus:ring-blue-500'
                                    }`}
                                />
                            </div>
                        </div>
                    )}

                    {isLoading && (
                        <div className="mt-6 flex justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                    )}
                </div>



                {/* Results Header */}
                <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl overflow-hidden card-modern mb-6`}>
                    <div className="px-6 py-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                        <h2 className="text-xl font-semibold flex items-center">
                            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Resultados da Busca
                        </h2>
                        <div className="flex gap-3 items-center">
                            <span className="text-sm bg-white bg-opacity-20 backdrop-filter backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                                <div className="status-indicator status-active"></div>
                                {filteredData.length} resultados
                            </span>
                            <button
                                onClick={exportToCSV}
                                disabled={filteredData.length === 0}
                                className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 btn-modern ${
                                    filteredData.length === 0
                                        ? 'bg-gray-500 cursor-not-allowed'
                                        : 'bg-white bg-opacity-20 hover:bg-opacity-30'
                                } text-white transition-all duration-200`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Exportar CSV
                            </button>
                        </div>
                    </div>

                    {noResults ? (
                        <div className="text-center py-16 animate-fadeInUp">
                            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4 animate-pulse-custom" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
                            </svg>
                            <h3 className={`text-lg font-medium ${darkMode ? 'text-gray-300' : 'text-gray-900'} mb-2`}>
                                Nenhum resultado encontrado
                            </h3>
                            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-4`}>
                                Tente ajustar o termo de pesquisa ou usar filtros diferentes.
                            </p>
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setSearchCode('');
                                    setSearchService('');
                                    setSearchCnaeCode('');
                                    setSearchCnaeDesc('');
                                    setCategoryFilter('todos');
                                    setAdvancedMode(false);
                                    setHistory([]);
                                    localStorage.removeItem('searchHistory');
                                }}
                                className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg btn-modern"
                            >
                                Limpar Filtros
                            </button>
                        </div>
                    ) : (
                        <div className="animate-fadeInUp">
                            {/* Cards View */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 custom-scrollbar" style={{maxHeight: '70vh', overflowY: 'auto'}}>
                                    {filteredData.slice(0, 100).map((item, index) => (
                                        <div key={index} className={`result-card ${darkMode ? 'dark' : ''} animate-fadeInUp`} style={{animationDelay: `${index * 0.05}s`}}>
                                            <div className="flex justify-between items-center mb-4">
                                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                                    darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                    LIST {item["LIST LC"].replace(/^0+/, '') || item["LIST LC"]}
                                                </span>
                                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                                    darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
                                                }`}>
                                                    CNAE {(() => {
                                                        const cnae = item["CNAE"].toString().replace(/[^0-9]/g, '');
                                                        if (cnae.length >= 7) {
                                                            const paddedCnae = cnae.padStart(7, '0');
                                                            return `${paddedCnae.slice(0, 4)}-${paddedCnae.slice(4, 5)}/${paddedCnae.slice(5, 7)}`;
                                                        }
                                                        return item["CNAE"];
                                                    })()}
                                                </span>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                <div>
                                                    <h3 className={`font-medium text-sm mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        Descrição do Serviço
                                                    </h3>
                                                    <p className={`text-sm leading-relaxed ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                                                        {item["Descrição item da lista da Lei Complementar nº 001/2003 - CTM"]}
                                                    </p>
                                                </div>
                                                
                                                <div>
                                                    <h4 className={`font-medium text-sm mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        Descrição CNAE
                                                    </h4>
                                                    <p className={`text-sm leading-relaxed ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                                                        {item["Descrição do CNAE"]}
                                                    </p>
                                                </div>
                                            </div>

                                        </div>
                                    ))}
                            </div>

                            {/* Pagination Info */}
                            {filteredData.length > 100 && (
                                <div className={`mt-6 px-6 py-4 rounded-lg ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center text-sm text-gray-500">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>
                                                Mostrando os primeiros <strong>100</strong> resultados de <strong>{filteredData.length.toLocaleString()}</strong> encontrados
                                            </span>
                                        </div>
                                        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                            Refine sua busca para ver resultados mais específicos
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <footer className={`text-center mt-8 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    <p>© 2025 Sistema de Consulta Fiscal</p>
                    <p className="mt-1">Desenvolvido por <span className={`font-medium ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>Murilo Miguel</span></p>
                </footer>
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
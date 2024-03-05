const apiUrl = 'http://api.valantis.store:40000/';
const password = 'Valantis';

const quantityProductsOnPage = 50;


let currentPage = 0;
let filterData = null;
main();


//Кнопки пагинации
const paginationBtnPrev = document.querySelector('.pagination_btn_prev');
const paginationBtnNext = document.querySelector('.pagination_btn_next');
paginationBtnPrev.addEventListener('click', () => {
    currentPage--;
    main();
});
paginationBtnNext.addEventListener('click', () => {
    currentPage++;
    main();
});

//Фильтры
const filterForm = document.querySelector('.filter_form');
const filterElements = document.querySelectorAll('.filter_element');
filterForm.addEventListener('submit', (event) => {
    event.preventDefault();

    filterData = serializeForm(filterElements);
    if(objIsEmpty(filterData)) {
        filterData = null;
    }
    main();
});
//Запрет заполнения больше одного фильтра
filterElements.forEach((filterElement) => {
    filterElement.addEventListener('change', (event) => {
        let filledInputType = event.currentTarget.name;

        if(event.currentTarget.value === '') {
            filterElements.forEach((filterElement) => {
                filterElement.disabled = false;
            })
        } else {
            filterElements.forEach((filterElement) => {
                if(filterElement.name !== filledInputType) {
                    filterElement.disabled = true;
                }
            })
        }

    });
});


function serializeForm(formElements) {
    let dataForm = {};

    for (let element of formElements) {
        if(element.value) {
            //Для нормального вида вместо позиций, по которым нет бренда, отрисован "-". Меняем его обратно на null при фильтрации
            if(element.value === '-') {
                dataForm[element.name] = null;
            } else {
                dataForm[element.name] = element.value;
            }
        }
    }
    return dataForm;
}

function objIsEmpty(obj) {
    for (let x in obj) {
         return false; 
    }
    return true;
}

function hidePaginationBtns(paginationBtnPrev, paginationBtnNext) {
    paginationBtnPrev.classList.add('pagination_btn_inactive');
    paginationBtnNext.classList.add('pagination_btn_inactive');
}

async function setStatusPaginationBthPrev(paginationBtnPrev, currentPage) {
    if(currentPage == 0) {
        paginationBtnPrev.classList.add('pagination_btn_inactive');
        return;
    }

    if(await getData(currentPage - 1, null, true)) {
        paginationBtnPrev.classList.remove('pagination_btn_inactive');
    } else {
        paginationBtnPrev.classList.add('pagination_btn_inactive');
    }
}

async function setStatusPaginationBthNext(paginationBtnNext, currentPage) {
    if(await getData(currentPage + 1, null, true)) {
        paginationBtnNext.classList.remove('pagination_btn_inactive');
    } else {
        paginationBtnNext.classList.add('pagination_btn_inactive');
    }
}


async function main() {
    waitingStart();

    let products;
    try {
        products = await getData(currentPage, filterData);
    } catch(error) {
        console.log(error.message);
    } finally {
        waitingStop();
    }

    if(products) {
        updateView(products, filterData);
    }

}

async function getData(currentPage, filterData, onlyIds = false) {
    let productsId;
    let products;

    if(!filterData) {
        productsId = await getDataByApi('get_ids', null, null, currentPage * quantityProductsOnPage);
    } else {
        productsId = await getDataByApi('filter', filterData);
    }

    if(!productsId) {
        return false;
    }
    if(onlyIds) {
        return productsId;
    }

    //Обрезаем массив, если фильтр вернул слишком много сущностей, потому что апи не умеет в ограничение числа сущностей при фильтрации
    if(productsId.length > 50) {
        productsId = productsId.slice(0, 50);
    }

    products = await getDataByApi('get_items', null, productsId);

    if(!products) {
        return false;
    }

    products = removeDoubles(products);

    return products;
}

function waitingStart() {
    document.body.style.cursor = 'wait';

    const blockWindow = document.querySelector('.block_window');
    blockWindow.classList.remove('block_window_inactive');
}

function waitingStop() {
    document.body.style.cursor = 'auto';

    const blockWindow = document.querySelector('.block_window');
    blockWindow.classList.add('block_window_inactive');
}

function removeDoubles(items) {
    items = items.filter((value, index, self) =>
        index === self.findIndex((t) => (
            t.place === value.place && t.id === value.id
        ))
    );

    return items;
}


async function updateView(products, filterData) {
    renderRows(products);

    if(!filterData) {
        setStatusPaginationBthPrev(paginationBtnPrev, currentPage);
        setStatusPaginationBthNext(paginationBtnNext, currentPage);    
    } else {
        hidePaginationBtns(paginationBtnPrev, paginationBtnNext);
    }

}

function renderRows(products) {
    const tbodyElement = document.querySelector('.tbodyElement');
    tbodyElement.innerHTML = '';

    if(products.length === 0) {
        const message = `
        <tr>
            <td>
                Нет данных
            </td>
            <td>
                Нет данных
            </td>
            <td>
                Нет данных
            </td>
            <td>
                Нет данных
            </td>
        </tr>
        `;

        tbodyElement.innerHTML += message;

        return false;
    } 

    products.forEach(({id, product, price, brand}) => {
        const rowTable = `
            <tr>
                <td>
                    ${id}
                </td>
                <td>
                    ${product}
                </td>
                <td>
                    ${price}
                </td>
                <td>
                    ${brand ?? '-'}
                </td>
            </tr>
        `;

        tbodyElement.innerHTML += rowTable;
    });

}

async function getDataByApi(action, filterData = null, itemsId = {}, offset, limit = quantityProductsOnPage) {
    let params = {};
    switch(action) {
        case 'get_ids':
            params['offset'] = offset;
            params['limit'] = limit;
            break;

        case 'get_items':
            params['ids'] = itemsId;
            break;

        case 'filter':
            params = filterData;
            break;
    }

    let countQuery = 0;
    while(countQuery < 3) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'X-Auth': MD5(`${password}_${getDateForAuth()}`),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify ({
                    'action': action,
                    'params': params
                })
            });

            if(response.ok) {
                const result = await response.json();
                return result['result'];
            } else {
                throw new Error('Ошибка ' + response.status);
            }
        } catch(error) {
            console.log(error.message);
            sleep(1000);
        } finally {
            countQuery++;
        }

    }

    return false;
}

function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

function getDateForAuth() {
    let dateLocal = new Date();
    let dateUTC = new Date(Date.UTC(dateLocal.getFullYear(), dateLocal.getMonth(), dateLocal.getDate()));

    const year = dateUTC.getFullYear();
    const month = String(dateUTC.getMonth() + 1).padStart(2, '0');
    const day = String(dateUTC.getDate()).padStart(2, '0');

    return year + month + day;
}


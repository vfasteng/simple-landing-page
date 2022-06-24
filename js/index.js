"use strict";

// SERVICES TABS START

const tabsBtn = document.querySelectorAll(".tabs-title");
const tabsItems = document.querySelectorAll(".tabs-item")

tabsBtn.forEach(onTabClick);

function onTabClick (item) {
    item.addEventListener("click", function (){
        let currentBtn = item
        let tabId = currentBtn.getAttribute("data-tab")
        let currentTab = document.querySelector(tabId)

        if(! currentBtn.classList.contains("active")){
            tabsBtn.forEach (item => {
                item.classList.remove("active")
        })

        tabsItems.forEach (item => {
            item.classList.remove("active")
        })

        currentBtn.classList.add("active")
        currentTab.classList.add("active")
    }
    })
};

// SERVICES TABS END

// PORTFOLIO FILTER STARTS

function app (){
    const buttons = document.querySelectorAll(".portfolio_item");
    const cards = document.querySelectorAll(".portfolio_img_item"
    )

    function filter (category, items){
        items.forEach((item) => {
            const isItemFiltered = !item.classList.contains(category)
            const isShowAll = category.toLowerCase() === "all"
            if(isItemFiltered && !isShowAll){
                item.classList.add("hide")
            } else {
                item.classList.remove("hide")
            }
        })

    }

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            buttons.forEach((item) => {
                item.classList.remove("active")
            })
            button.classList.add("active")
            const currentCategory = button.dataset.filter;
            filter(currentCategory, cards)
        })
    })
}

app()

// PORTFOLIO FILTER ENDS

// PORTFOLIO SHOW MORE STARTS

const showMoreBtn = document.querySelector(".show_more_btn")
showMoreBtn.addEventListener("click", showMore)

function showMore (){
    let imgEntries = document.querySelectorAll(".portfolio_img_item");
    imgEntries.forEach((image) => {
        if(image.classList.contains("more_img")){
            image.classList.remove("more_img")
        }
    })
    showMoreBtn.remove()
}

// PORTFOLIO SHOW MORE ENDS

// COMMENTS' CAROUSEL STARTS

const sliderSection = document.querySelector(".comments")
const nextBtn = document.querySelector(".next_btn");
const prevBtn = document.querySelector(".prev_btn");
const slides = document.querySelectorAll(".slide");
const slideIcons = document.querySelectorAll(".photo_nav");
const numberOfSlides = slides.length;
let slideNumber = 0;

// SLIDE SWITCH BY ICON

slideIcons.forEach(onIconClick);

function onIconClick(item){
    item.addEventListener("click", function (){
        let currentIcon = item;
        let slideId = currentIcon.getAttribute("data-slide");
        let currentSlide = document.querySelector(slideId);

        if (! currentIcon.classList.contains("active")){
            slideIcons.forEach(item => {
                item.classList.remove("active")
            })
            slides.forEach(item =>{
                item.classList.remove("active")
            })
            currentIcon.classList.add("active")
            currentSlide.classList.add("active")
        }
    })
}


//NEXT BUTTON

nextBtn.addEventListener('click', () => {
    slides.forEach((slide) => {
        slide.classList.remove("active")
    })
    slideIcons.forEach((slideIcon) => {
        slideIcon.classList.remove("active")
    })

    slideNumber++;

    if (slideNumber > (numberOfSlides - 1)){
        slideNumber = 0
    }
    slides[slideNumber].classList.add("active");
    slideIcons[slideNumber].classList.add("active")
})

//PREVIOUS BUTTON

prevBtn.addEventListener("click", () => {
    slides.forEach((slide) => {
        slide.classList.remove("active")
    })
    slideIcons.forEach((slideIcon) => {
        slideIcon.classList.remove("active")
    })

    slideNumber--;

    if (slideNumber < 0){
        slideNumber = numberOfSlides - 1;
    }
    slides[slideNumber].classList.add("active");
    slideIcons[slideNumber].classList.add("active")
})

// COMMENTS' CAROUSEL ENDS
